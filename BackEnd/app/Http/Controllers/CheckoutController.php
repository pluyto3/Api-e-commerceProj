<?php

namespace App\Http\Controllers;

use App\Models\addToCart;
use App\Models\CheckoutSellerOrder;
use App\Models\Checkout;
use App\Models\CheckoutItem;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use App\Services\PushNotificationService;

class CheckoutController extends Controller
{
    private const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'cancelled'];
    private const SHIPPING_STATUSES = ['pending', 'packed', 'shipped', 'delivered', 'cancelled'];

    private function getAuthenticatedUser(Request $request): ?User
    {
        $token = $request->bearerToken();

        if (!$token) {
            return null;
        }

        return User::where('token', $token)->first();
    }

    private function normalizeShippingStatus(?string $status): string
    {
        $value = strtolower(trim((string) $status));
        $value = str_replace(['_', '-'], ' ', $value);
        $value = preg_replace('/\s+/', ' ', $value);

        return match ($value) {
            'to ship', 'to_ship', 'processing' => 'packed',
            'complete', 'completed' => 'delivered',
            default => str_replace(' ', '_', $value ?: 'pending'),
        };
    }

    private function normalizePaymentStatus(?string $status): string
    {
        return strtolower(trim((string) ($status ?: 'pending')));
    }

    private function initialPaymentStatus(string $paymentMethod): string
    {
        return strtolower($paymentMethod) === 'cod' ? 'pending' : 'pending';
    }

    private function syncLegacyStatus(Checkout $checkout): void
    {
        $checkout->status = $checkout->shipping_status ?: $checkout->status ?: 'pending';
    }

    private function ensureCheckoutItemsCanBePurchased($cartItems, $products, User $user): void
    {
        foreach ($cartItems as $item) {
            $product = $products->get($item->product_id);
            $quantity = (int) $item->quantity;

            if (!$product) {
                throw ValidationException::withMessages([
                    'item_ids' => 'One of the selected products no longer exists.',
                ]);
            }

            if ((int) $product->seller_id === (int) $user->user_id) {
                throw ValidationException::withMessages([
                    'item_ids' => "You cannot check out your own product: {$product->product_name}.",
                ]);
            }

            /*
            * Seller must still exist and be active.
            */
            if (
                !$product->seller ||
                !$product->seller->is_active
            ) {
                throw ValidationException::withMessages([
                    'item_ids' =>
                        "{$product->product_name} is unavailable because the Seller account is inactive."
                ]);
            }

            /*
            * Brand must still be approved and active.
            */
            if (
                !$product->brand ||
                strtolower($product->brand->status ?? '') !== 'approved' ||
                !$product->brand->is_active
            ) {
                throw ValidationException::withMessages([
                    'item_ids' =>
                        "{$product->product_name} is unavailable because its Brand is inactive or unavailable."
                ]);
            }

            /*
            * Category must still be approved and active.
            */
            if (
                !$product->category ||
                strtolower($product->category->status ?? '') !== 'approved' ||
                !$product->category->is_active
            ) {
                throw ValidationException::withMessages([
                    'item_ids' =>
                        "{$product->product_name} is unavailable because its Category is inactive or unavailable."
                ]);
            }

            if (($product->approval_status ?? 'pending') !== 'approved') {
                throw ValidationException::withMessages([
                    'item_ids' => "{$product->product_name} is not available for checkout.",
                ]);
            }

            if (($product->status ?? 'active') !== 'active') {
                throw ValidationException::withMessages([
                    'item_ids' => "{$product->product_name} is currently {$product->status}.",
                ]);
            }

            if ((int) $product->stock_quantity <= 0) {
                throw ValidationException::withMessages([
                    'item_ids' => "{$product->product_name} is out of stock.",
                ]);
            }

            if ($quantity > (int) $product->stock_quantity) {
                throw ValidationException::withMessages([
                    'item_ids' => "Only {$product->stock_quantity} item(s) left for {$product->product_name}.",
                ]);
            }
        }
    }

    private function reduceProductStock(Product $product, int $quantity): void
    {
        $product->stock_quantity = max(0, (int) $product->stock_quantity - $quantity);

        if ($product->stock_quantity <= 0) {
            $product->status = 'out_of_stock';
        }

        $product->save();
    }

    private function restoreSellerOrderStock(
    Checkout $checkout,
    int $sellerId
    ): void {
        $items = $checkout->items()
            ->where('seller_id', $sellerId)
            ->get();

        $productIds = $items
            ->pluck('product_id')
            ->unique()
            ->values();

        if ($productIds->isEmpty()) {
            return;
        }

        $products = Product::whereIn('product_id', $productIds)
            ->lockForUpdate()
            ->get()
            ->keyBy('product_id');

        foreach ($items as $item) {
            $product = $products->get($item->product_id);

            if (!$product) {
                continue;
            }

            $product->stock_quantity =
                (int) $product->stock_quantity +
                (int) $item->quantity;

            if (
                $product->status === 'out_of_stock' &&
                $product->stock_quantity > 0
            ) {
                $product->status = 'active';
            }

            $product->save();
        }
    }

    private function syncCheckoutShippingFromSellerOrders(
    Checkout $checkout
    ): void {
        $statuses = CheckoutSellerOrder::where(
                'checkout_id',
                $checkout->checkout_id
            )
            ->pluck('shipping_status')
            ->map(fn ($status) =>
                $this->normalizeShippingStatus($status)
            );

        if ($statuses->isEmpty()) {
            return;
        }

        if ($statuses->every(fn ($status) => $status === 'cancelled')) {
            $overallStatus = 'cancelled';
        } else {

            $activeStatuses = $statuses
                ->reject(fn ($status) => $status === 'cancelled')
                ->values();

            if ($activeStatuses->contains('pending')) {
                $overallStatus = 'pending';
            } elseif ($activeStatuses->contains('packed')) {
                $overallStatus = 'packed';
            } elseif ($activeStatuses->contains('shipped')) {
                $overallStatus = 'shipped';
            } else {
                $overallStatus = 'delivered';
            }
        }

        $checkout->shipping_status = $overallStatus;
        $checkout->status = $overallStatus;
    }

    private function restoreCheckoutStock(Checkout $checkout): void
    {
        $items = $checkout->items()->get();
        $productIds = $items->pluck('product_id')->unique()->values();

        if ($productIds->isEmpty()) {
            return;
        }

        $products = Product::whereIn('product_id', $productIds)
            ->lockForUpdate()
            ->get()
            ->keyBy('product_id');

        foreach ($items as $item) {
            $product = $products->get($item->product_id);

            if (!$product) {
                continue;
            }

            $product->stock_quantity = (int) $product->stock_quantity + (int) $item->quantity;

            if ($product->status === 'out_of_stock' && $product->stock_quantity > 0) {
                $product->status = 'active';
            }

            $product->save();
        }
    }

    private function canSellerAccessCheckout(Checkout $checkout, User $user): bool
    {
        return $checkout->items()
            ->where('seller_id', $user->user_id)
            ->exists();
    }

    private function formatImagePath(?Product $product): string
    {
        return $product?->image
            ? 'FrontEnd/assets/img/product/' . $product->image
            : 'assets/img/back.jpg';
    }

    private function formatOrder(Checkout $order): array
    {
        $items = $order->items ?? collect();

        $sellerOrders = $order->sellerOrders ?? collect();

        $sellerNames = $items
            ->map(function ($item) {
                return $item->seller?->username
                    ?? $item->product?->seller?->username
                    ?? null;
            })
            ->filter()
            ->unique()
            ->values();

        $shippingStatus = $order->shipping_status ?: $order->status ?: 'pending';
        $paymentStatus = $order->payment_status ?: 'pending';

        return [
            'checkout_id' => $order->checkout_id,
            'user_id' => $order->user_id,
            'user' => $order->user ? [
                'user_id' => $order->user->user_id,
                'username' => $order->user->username,
                'fullname' => $order->user->fullname,
                'email' => $order->user->email,
            ] : null,
            'payment_method' => $order->payment_method,
            'payment_status' => $paymentStatus,
            'shipping_status' => $shippingStatus,
            'status' => $shippingStatus,
            'total_amount' => $order->total_amount,
            'tracking_number' => $order->tracking_number,
            'seller_orders' => $sellerOrders->map(function ($sellerOrder) {
                return [
                    'checkout_seller_order_id' =>
                        $sellerOrder->checkout_seller_order_id,

                    'seller_id' =>
                        $sellerOrder->seller_id,

                    'seller_name' =>
                        $sellerOrder->seller?->username,

                    'shipping_status' =>
                        $sellerOrder->shipping_status,

                    'tracking_number' =>
                        $sellerOrder->tracking_number,

                    'seller_subtotal' =>
                        $sellerOrder->seller_subtotal,

                    'cancelled_at' =>
                        $sellerOrder->cancelled_at,

                    'cancellation_reason' =>
                        $sellerOrder->cancellation_reason,
                ];
            })
            ->values(),
            'created_date' => $order->created_at ? Carbon::parse($order->created_at)->toDateString() : null,
            'created_at' => $order->created_at ? Carbon::parse($order->created_at)->format('M d, Y') : null,
            'updated_at' => $order->updated_at,
            'purok' => $order->purok,
            'barangay' => $order->barangay,
            'city' => $order->city,
            'province' => $order->province,
            'zipcode' => $order->zipcode,
            'phone_number' => $order->phone_number,
            'item_count' => $items->count(),
            'shop_name' => $sellerNames->isNotEmpty() ? $sellerNames->implode(', ') : 'Unknown Shop',
            'items' => $items->map(function ($item) {
                return [
                    'checkout_item_id' => $item->checkout_item_id,
                    'product_id' => $item->product_id,
                    'seller_id' => $item->seller_id,
                    'product_name' => $item->product ? $item->product->product_name : 'Unknown Product',
                    'quantity' => $item->quantity,
                    'price' => $item->price,
                    'subtotal' => $item->subtotal,
                    'seller_name' => $item->seller?->username ?? $item->product?->seller?->username,
                    'image' => $this->formatImagePath($item->product),
                    'product' => $item->product,
                    'seller' => $item->seller,
                ];
            })->values(),
        ];
    }

    /**
     * Send push notification safely, logging any failures.
     */
    private function sendPushSafely(
        int $userId,
        string $title,
        string $message,
        string $link,
        string $type,
        $relatedId = null
    ): void {
        try {
            app(PushNotificationService::class)->sendToUser(
                $userId,
                $title,
                $message,
                $link,
                $type,
                $relatedId
            );
        } catch (\Throwable $e) {
            Log::warning('Checkout push notification failed.', [
                'user_id' => $userId,
                'type' => $type,
                'related_id' => $relatedId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Create checkout, order items, and stock deduction atomically.
     */
    public function createCheckout(Request $request) {
        $user = $this->getAuthenticatedUser($request);

        // User must be authenticated.
        if (!$user) {
            return response()->json(['msg' => 'Invalid or missing token.'], 401);
        }

        // User must be active.
        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        // Only buyer accounts may place orders.
        if ($user->role !== 'user') {
            return response()->json([
                'msg' => 'Only customer accounts can place orders.'
            ], 403);
        }

        $validated = $request->validate([
            'payment_method' => 'required|string|in:cod,gcash',
            'purok' => 'required|string|max:50',
            'barangay' => 'required|string|max:100',
            'city' => 'required|string|max:100',
            'province' => 'required|string|max:100',
            'zipcode' => 'required|string|max:10',
            'phone' => 'required|string|max:20',
            'total_amount' => 'nullable|numeric|min:0',
            'item_ids' => 'required|array|min:1',
            'item_ids.*' => 'integer',
        ]);

        $selectedIds = collect($validated['item_ids'])
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $stockAlerts = [];
        $lowStockThreshold = 3;

        $checkout = DB::transaction(function () use (
            $request,
            $user,
            $selectedIds,
            $validated,
            &$stockAlerts,
            $lowStockThreshold
        ) {
            $cartItems = addToCart::where('user_id', $user->user_id)
                ->whereIn('addTocart_id', $selectedIds)
                ->lockForUpdate()
                ->get();

            if ($cartItems->count() !== $selectedIds->count()) {
                throw ValidationException::withMessages([
                    'item_ids' => 'Some selected cart items were not found. Please refresh your cart.',
                ]);
            }

            $productIds = $cartItems->pluck('product_id')->unique()->values();
            $products = Product::with([
                    'seller',
                    'brand',
                    'category'
                ])
                ->whereIn('product_id', $productIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('product_id');

            $this->ensureCheckoutItemsCanBePurchased($cartItems, $products, $user);

            $requestedQuantities = $cartItems
                ->groupBy('product_id')
                ->map(fn ($items) => $items->sum('quantity'));

            foreach ($requestedQuantities as $productId => $requestedQuantity) {
                $product = $products->get($productId);

                if (!$product) {
                    throw ValidationException::withMessages([
                        'item_ids' => 'One of the selected products no longer exists.',
                    ]);
                }

                if ((int) $requestedQuantity > (int) $product->stock_quantity) {
                    throw ValidationException::withMessages([
                        'item_ids' => "Only {$product->stock_quantity} item(s) left for {$product->product_name}.",
                    ]);
                }
            }

            $computedTotal = $cartItems->sum(function ($item) use ($products) {
                $product = $products->get($item->product_id);
                return (float) $product->product_price * (int) $item->quantity;
            });

            $checkout = new Checkout();
            $checkout->user_id = $user->user_id;
            $checkout->payment_method = $validated['payment_method'];
            $checkout->payment_status = $this->initialPaymentStatus($validated['payment_method']);
            $checkout->purok = $request->purok;
            $checkout->barangay = $request->barangay;
            $checkout->city = $request->city;
            $checkout->province = $request->province;
            $checkout->zipcode = $request->zipcode;
            $checkout->phone_number = $request->phone;
            $checkout->total_amount = $computedTotal;
            $checkout->shipping_status = 'pending';
            $checkout->status = 'pending';
            $checkout->save();

            foreach ($cartItems as $item) {
                $product = $products->get($item->product_id);
                $quantity = (int) $item->quantity;
                $price = (float) $product->product_price;

                CheckoutItem::create([
                    'checkout_id' => $checkout->checkout_id,
                    'product_id' => $item->product_id,
                    'seller_id' => $product->seller_id,
                    'quantity' => $quantity,
                    'price' => $price,
                    'subtotal' => $quantity * $price,
                ]);

                $oldStock = (int) $product->stock_quantity;

                $this->reduceProductStock($product, $quantity);

                $product->refresh();

                $newStock = (int) $product->stock_quantity;

                if ($product->seller_id) {
                    if ($oldStock > 0 && $newStock <= 0) {
                        $stockAlerts[$product->product_id] = [
                            'seller_id' => $product->seller_id,
                            'title' => 'Out of Stock',
                            'message' => $product->product_name . ' is now out of stock.',
                            'link' => 'product.html',
                            'type' => 'out_of_stock',
                            'related_id' => $product->product_id,
                        ];
                    } elseif ($oldStock > $lowStockThreshold && $newStock <= $lowStockThreshold) {
                        $stockAlerts[$product->product_id] = [
                            'seller_id' => $product->seller_id,
                            'title' => 'Low Stock Alert',
                            'message' => $product->product_name . ' has only ' . $newStock . ' stocks left.',
                            'link' => 'product.html',
                            'type' => 'low_stock',
                            'related_id' => $product->product_id,
                        ];
                    }
                }
            }

            // Create One Fulfillment record per seller 
            $sellerOrderTotals = CheckoutItem::where(
                    'checkout_id',
                    $checkout->checkout_id
                )
                ->whereNotNull('seller_id')
                ->select(
                    'seller_id',
                    DB::raw('SUM(subtotal) as seller_subtotal')
                )
                ->groupBy('seller_id')
                ->get();

            foreach ($sellerOrderTotals as $sellerOrderTotal) {
                CheckoutSellerOrder::create([
                    'checkout_id' => $checkout->checkout_id,
                    'seller_id' => $sellerOrderTotal->seller_id,
                    'shipping_status' => 'pending',
                    'tracking_number' => null,
                    'seller_subtotal' => $sellerOrderTotal->seller_subtotal,
                ]);
            }

            addToCart::where('user_id', $user->user_id)
                ->whereIn('addTocart_id', $selectedIds)
                ->delete();

            return $checkout;
        });

        $checkout->load(['user', 'items.product.brand', 'items.product.seller', 'items.seller', 'sellerOrders.seller']);
        $formatted = $this->formatOrder($checkout);

        foreach ($stockAlerts as $alert) {
            $this->sendPushSafely(
                $alert['seller_id'],
                $alert['title'],
                $alert['message'],
                $alert['link'],
                $alert['type'],
                $alert['related_id']
            );
        }

        $orderId = $checkout->checkout_id;

        $sellerIds = $checkout->items
            ->pluck('seller_id')
            ->filter()
            ->unique()
            ->values();

        foreach ($sellerIds as $sellerId) {
            $this->sendPushSafely(
                $sellerId,
                'New Order Received',
                'You received a new order #' . $orderId . '.',
                'orderDetails.html',
                'new_order',
                $orderId
            );
        }

        return response()->json([
            'message' => 'Order placed successfully.',
            'order_id' => $checkout->checkout_id,
            'checkout' => $formatted,
            'items' => $formatted['items'],
        ], 201);
    }

    /**
     * Fetch buyer orders.
     */
    public function getUserOrders(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);

        // User must be authenticated.
        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        // User must be active.
        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        // Only customer accounts may access buyer order history.
        if ($user->role !== 'user') {
            return response()->json([
                'msg' => 'Only customer accounts can access this order history.'
            ], 403);
        }

        $orders = Checkout::with(['user', 'items.product.brand', 'items.product.seller', 'items.seller', 'sellerOrders.seller'])
            ->where('user_id', $user->user_id)
            ->orderBy('checkout_id', 'DESC')
            ->get();

        return response()->json([
            'data' => $orders->map(fn ($order) => $this->formatOrder($order))->values(),
        ], 200);
    }

    /**
     * Get a single checkout with items.
     */
    public function getOrderDetails($checkout_id)
    {
        $user = $this->getAuthenticatedUser(request());

        // User must be authenticated.
        if (!$user) {
            return response()->json(['message' => 'Invalid Token'], 401);
        }

        // User must be active.
        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        // Only customer accounts may access buyer order details.
        if ($user->role !== 'user') {
            return response()->json([
                'msg' => 'Only customer accounts can access buyer order details.'
            ], 403);
        }

        $order = Checkout::with(['user', 'items.product.brand', 'items.product.seller', 'items.seller', 'sellerOrders.seller'])
            ->where('checkout_id', $checkout_id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        $formatted = $this->formatOrder($order);

        return response()->json([
            'order' => $formatted,
            'items' => $formatted['items'],
        ], 200);
    }

    /**
     * Update seller fulfillment status/tracking
     * or overall checkout payment status.
     */
    public function updateStatus(Request $request, $checkout_id)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid Token.'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        if (!in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json([
                'msg' => 'Unauthorized.'
            ], 403);
        }

        $incomingShipping = $request->input(
            'shipping_status',
            $request->input('status')
        );

        $incomingPayment = $request->input('payment_status');

        $incomingTracking = trim(
            (string) $request->input('tracking_number', '')
        );

        if (
            !$incomingShipping &&
            !$incomingPayment &&
            $incomingTracking === ''
        ) {
            return response()->json([
                'msg' =>
                    'Please provide a shipping status, payment status, or tracking number.'
            ], 422);
        }

        $shippingStatus = $incomingShipping
            ? $this->normalizeShippingStatus($incomingShipping)
            : null;

        $paymentStatus = $incomingPayment
            ? $this->normalizePaymentStatus($incomingPayment)
            : null;
        
        if (
            $paymentStatus &&
            !in_array(
                $paymentStatus,
                self::PAYMENT_STATUSES,
                true
            )
        ) {
            return response()->json([
                'msg' => 'Invalid payment status value.'
            ], 422);
        }

        /*
        * Payment cancellation must use the order cancellation workflow.
        */
        if ($shippingStatus === 'cancelled') {
            return response()->json([
                'msg' =>
                    'Order cancellation must use the cancellation workflow.'
            ], 422);
        }

        if (
            $shippingStatus &&
            !in_array(
                $shippingStatus,
                ['pending', 'packed', 'shipped', 'delivered'],
                true
            )
        ) {
            return response()->json([
                'msg' => 'Invalid shipping status value.'
            ], 422);
        }

        if (
            $paymentStatus &&
            !in_array(
                $paymentStatus,
                self::PAYMENT_STATUSES,
                true
            )
        ) {
            return response()->json([
                'msg' => 'Invalid payment status value.'
            ], 422);
        }

        if (
            $incomingTracking !== '' &&
            strlen($incomingTracking) > 100
        ) {
            return response()->json([
                'msg' =>
                    'Tracking number may not be greater than 100 characters.'
            ], 422);
        }

        /*
        * Seller cannot modify the checkout-wide payment status.
        */
        if (
            $user->role === 'seller' &&
            $paymentStatus
        ) {
            return response()->json([
                'msg' =>
                    'Sellers can update shipping status and tracking only.'
            ], 403);
        }

        $checkoutForAuth = Checkout::find($checkout_id);

        if (!$checkoutForAuth) {
            return response()->json([
                'msg' => 'Checkout not found.'
            ], 404);
        }

        /*
        * Shipping/tracking belongs to a specific seller fulfillment.
        */
        $requiresSellerOrder =
            $shippingStatus !== null ||
            $incomingTracking !== '';

        $targetSellerId = null;
        $sellerOrderForAuth = null;

        if ($requiresSellerOrder) {

            /*
            * Seller automatically targets their own portion.
            */
            if ($user->role === 'seller') {
                $targetSellerId = (int) $user->user_id;
            }

            /*
            * Admin must explicitly choose which seller
            * fulfillment is being updated.
            */
            if ($user->role === 'admin') {

                if (!$request->filled('seller_id')) {
                    return response()->json([
                        'msg' =>
                            'seller_id is required when an admin updates shipping or tracking.'
                    ], 422);
                }

                if (!is_numeric($request->input('seller_id'))) {
                    return response()->json([
                        'msg' => 'Invalid seller_id.'
                    ], 422);
                }

                $targetSellerId =
                    (int) $request->input('seller_id');
            }

            $sellerOrderForAuth =
                CheckoutSellerOrder::where(
                    'checkout_id',
                    $checkout_id
                )
                ->where(
                    'seller_id',
                    $targetSellerId
                )
                ->first();

            if (!$sellerOrderForAuth) {
                return response()->json([
                    'msg' =>
                        'Seller fulfillment record not found for this checkout.'
                ], 404);
            }
        }

        $oldPaymentStatus =
            $this->normalizePaymentStatus(
                $checkoutForAuth->payment_status
            );

        $oldSellerShippingStatus =
            $sellerOrderForAuth
                ? $this->normalizeShippingStatus(
                    $sellerOrderForAuth->shipping_status
                )
                : null;

        $oldSellerTrackingNumber =
            $sellerOrderForAuth
                ? trim(
                    (string) $sellerOrderForAuth->tracking_number
                )
                : '';

        $result = DB::transaction(function () use (
            $checkout_id,
            $targetSellerId,
            $shippingStatus,
            $paymentStatus,
            $incomingTracking
        ) {
            $checkout = Checkout::where(
                    'checkout_id',
                    $checkout_id
                )
                ->lockForUpdate()
                ->first();

            if (!$checkout) {
                return null;
            }

            /*
            * A completely cancelled checkout cannot
            * return to fulfillment.
            */
            $overallCurrentStatus =
                $this->normalizeShippingStatus(
                    $checkout->shipping_status
                        ?: $checkout->status
                );

            if (
                $overallCurrentStatus === 'cancelled' &&
                ($shippingStatus || $incomingTracking !== '')
            ) {
                throw ValidationException::withMessages([
                    'shipping_status' =>
                        'Cancelled orders cannot be moved back to active shipping statuses.'
                ]);
            }

            $sellerOrder = null;

            if ($targetSellerId !== null) {

                $sellerOrder =
                    CheckoutSellerOrder::where(
                        'checkout_id',
                        $checkout_id
                    )
                    ->where(
                        'seller_id',
                        $targetSellerId
                    )
                    ->lockForUpdate()
                    ->first();

                if (!$sellerOrder) {
                    throw ValidationException::withMessages([
                        'seller_id' =>
                            'Seller fulfillment record was not found.'
                    ]);
                }

                $currentSellerStatus =
                    $this->normalizeShippingStatus(
                        $sellerOrder->shipping_status
                    );
                $statusRank = [
                    'pending' => 0,
                    'packed' => 1,
                    'shipped' => 2,
                    'delivered' => 3,
                ];

                if (
                    $shippingStatus &&
                    isset(
                        $statusRank[$currentSellerStatus],
                        $statusRank[$shippingStatus]
                    ) &&
                    $statusRank[$shippingStatus] <
                        $statusRank[$currentSellerStatus]
                ) {
                    throw ValidationException::withMessages([
                        'shipping_status' =>
                            'Shipping status cannot move backwards.'
                    ]);
                }
                /*
                * Cancelled seller portions are final.
                */
                if ($currentSellerStatus === 'cancelled') {
                    throw ValidationException::withMessages([
                        'shipping_status' =>
                            'Cancelled seller fulfillments cannot be changed.'
                    ]);
                }

                /*
                * Delivered seller portions are final.
                */
                if (
                    $currentSellerStatus === 'delivered' &&
                    (
                        (
                            $shippingStatus &&
                            $shippingStatus !== 'delivered'
                        ) ||
                        $incomingTracking !== ''
                    )
                ) {
                    throw ValidationException::withMessages([
                        'shipping_status' =>
                            'Delivered seller fulfillments are final and cannot be changed.'
                    ]);
                }

                if ($shippingStatus) {
                    $sellerOrder->shipping_status =
                        $shippingStatus;

                    /*
                    * Automatically create a tracking number
                    * when this seller ships their portion.
                    */
                    if (
                        $shippingStatus === 'shipped' &&
                        empty($sellerOrder->tracking_number)
                    ) {
                        $sellerOrder->tracking_number =
                            $this->generateTrackingNumber(
                                $checkout_id,
                                $targetSellerId
                            );
                    }
                }

                if ($incomingTracking !== '') {

                    $trackingAllowedStatus =
                        $shippingStatus
                            ?: $currentSellerStatus;

                    if (
                        !in_array(
                            $trackingAllowedStatus,
                            ['packed', 'shipped'],
                            true
                        )
                    ) {
                        throw ValidationException::withMessages([
                            'tracking_number' =>
                                'Tracking number can only be updated when the seller order is packed or shipped.'
                        ]);
                    }

                    $sellerOrder->tracking_number =
                        $incomingTracking;
                }

                $sellerOrder->save();

                /*
                * Recalculate the checkout-wide summary status.
                */
                $this->syncCheckoutShippingFromSellerOrders(
                    $checkout
                );

                /*
                * COD becomes paid only after every active
                * seller fulfillment is delivered.
                */
                if (
                    $checkout->shipping_status === 'delivered' &&
                    strtolower(
                        (string) $checkout->payment_method
                    ) === 'cod' &&
                    $checkout->payment_status === 'pending'
                ) {
                    $checkout->payment_status = 'paid';
                }

                /*
                * Keep legacy checkout tracking compatible
                * for single-seller orders.
                */
                $sellerOrderCount =
                    CheckoutSellerOrder::where(
                        'checkout_id',
                        $checkout_id
                    )->count();

                if ($sellerOrderCount === 1) {
                    $checkout->tracking_number =
                        $sellerOrder->tracking_number;
                }
            }

            /*
            * Payment remains checkout-wide and Admin-only.
            */
            if ($paymentStatus) {
                $checkout->payment_status =
                    $paymentStatus;
            }

            $this->syncLegacyStatus($checkout);

            $checkout->save();

            return [
                'checkout' => $checkout,
                'seller_order' => $sellerOrder,
            ];
        });

        if (!$result) {
            return response()->json([
                'msg' => 'Checkout not found.'
            ], 404);
        }

        $checkout = $result['checkout'];

        $sellerOrder = $result['seller_order'];

        if ($user->role === 'seller') {
            $checkout->load([
                'user',

                'items' => function ($itemsQuery) use ($user) {
                    $itemsQuery
                        ->where('seller_id', $user->user_id)
                        ->with([
                            'product.brand',
                            'product.category',
                            'product.seller',
                            'seller'
                        ]);
                },

                'sellerOrders' => function ($sellerOrderQuery) use ($user) {
                    $sellerOrderQuery
                        ->where('seller_id', $user->user_id)
                        ->with('seller');
                },
            ]);
        } else {
            $checkout->load([
                'user',
                'items.product.brand',
                'items.product.category',
                'items.product.seller',
                'items.seller',
                'sellerOrders.seller'
            ]);
        }

        if ($sellerOrder) {
            $sellerOrder->load('seller');
        }

        $newPaymentStatus =
            $this->normalizePaymentStatus(
                $checkout->payment_status
            );

        $newSellerShippingStatus =
            $sellerOrder
                ? $this->normalizeShippingStatus(
                    $sellerOrder->shipping_status
                )
                : null;

        $newSellerTrackingNumber =
            $sellerOrder
                ? trim(
                    (string) $sellerOrder->tracking_number
                )
                : '';

        $shippingChanged =
            $sellerOrder &&
            $shippingStatus &&
            $oldSellerShippingStatus !==
                $newSellerShippingStatus;

        $trackingChanged =
            $sellerOrder &&
            $oldSellerTrackingNumber !==
                $newSellerTrackingNumber;

        $paymentChanged =
            $paymentStatus &&
            $oldPaymentStatus !==
                $newPaymentStatus;

        $buyerUserId = $checkout->user_id;

        $orderId = $checkout->checkout_id;

        /*
        * Notify buyer about this specific seller's
        * fulfillment progress.
        */
        if ($shippingChanged) {

            $sellerName =
                $sellerOrder->seller?->username
                    ?? 'Seller';

            $this->sendPushSafely(
                $buyerUserId,
                'Order Status Updated',
                $sellerName .
                    ' updated items in order #' .
                    $orderId .
                    ' to ' .
                    ucfirst(
                        str_replace(
                            '_',
                            ' ',
                            $newSellerShippingStatus
                        )
                    ) .
                    '.',
                'orderDetails.html',
                'order_status',
                $orderId
            );
        }

        if ($trackingChanged) {

            $sellerName =
                $sellerOrder->seller?->username
                    ?? 'Seller';

            $this->sendPushSafely(
                $buyerUserId,
                'Tracking Number Updated',
                $sellerName .
                    ' added tracking information for order #' .
                    $orderId .
                    '.',
                'orderDetails.html',
                'tracking_update',
                $orderId
            );
        }

        if ($paymentChanged) {

            $title =
                $newPaymentStatus === 'failed'
                    ? 'Payment Failed'
                    : 'Payment Update';

            $message =
                $newPaymentStatus === 'failed'
                    ? 'Your payment for order #' .
                        $orderId .
                        ' was not successful.'
                    : 'Your payment for order #' .
                        $orderId .
                        ' is now ' .
                        ucfirst(
                            str_replace(
                                '_',
                                ' ',
                                $newPaymentStatus
                            )
                        ) .
                        '.';

                $this->sendPushSafely(
                    $buyerUserId,
                    $title,
                    $message,
                    'orderDetails.html',
                    'payment_status',
                    $orderId
                );
        }

        return response()->json([
            'msg' =>
                'Order status updated successfully.',

            'checkout' =>
                $this->formatOrder($checkout),

            'seller_order' =>
                $sellerOrder
                    ? [
                        'checkout_seller_order_id' =>
                            $sellerOrder
                                ->checkout_seller_order_id,

                        'checkout_id' =>
                            $sellerOrder->checkout_id,

                        'seller_id' =>
                            $sellerOrder->seller_id,

                        'seller_name' =>
                            $sellerOrder
                                ->seller?->username,

                        'shipping_status' =>
                            $sellerOrder
                                ->shipping_status,

                        'tracking_number' =>
                            $sellerOrder
                                ->tracking_number,

                        'seller_subtotal' =>
                            $sellerOrder
                                ->seller_subtotal,
                    ]
                    : null,
        ], 200);
    }

    private function generateTrackingNumber(
        $checkout_id,
        $seller_id = null
    ): string {
        $tracking =
            'TRK-' .
            now()->format('Ymd') .
            '-' .
            str_pad(
                $checkout_id,
                6,
                '0',
                STR_PAD_LEFT
            );

        if ($seller_id !== null) {
            $tracking .=
                '-S' .
                str_pad(
                    $seller_id,
                    6,
                    '0',
                    STR_PAD_LEFT
                );
        }

        return $tracking;
    }

    /**
     * Buyer cancel entire order.
     */
    public function cancelOrder(Request $request, $checkout_id)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid Token.'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        // Only customers and administrators may cancel orders.
        if (!in_array($user->role, ['user', 'admin'], true)) {
            return response()->json([
                'msg' => 'Only customers or administrators can cancel orders.'
            ], 403);
        }

        $checkout = DB::transaction(function () use (
            $request,
            $checkout_id,
            $user
        ) {
            /*
            * Admin may access any checkout.
            * Other users may access only their own checkout.
            */
            $checkoutQuery = Checkout::where(
                    'checkout_id',
                    $checkout_id
                )
                ->lockForUpdate();

            if ($user->role !== 'admin') {
                $checkoutQuery->where(
                    'user_id',
                    $user->user_id
                );
            }

            $checkout = $checkoutQuery->first();

            if (!$checkout) {
                return null;
            }

            $isAdmin = $user->role === 'admin';

            $currentOverallStatus =
                $this->normalizeShippingStatus(
                    $checkout->shipping_status
                        ?: $checkout->status
                );

            /*
            * Prevent repeated cancellation attempts.
            */
            if ($currentOverallStatus === 'cancelled') {
                throw ValidationException::withMessages([
                    'status' => 'This order is already cancelled.'
                ]);
            }

            /*
            * Lock all seller fulfillment records.
            */
            $sellerOrders = CheckoutSellerOrder::where(
                    'checkout_id',
                    $checkout->checkout_id
                )
                ->lockForUpdate()
                ->get();

            if ($sellerOrders->isNotEmpty()) {

                if ($isAdmin) {
                    /*
                    * Admin may cancel pending/packed orders,
                    * but not once anything has shipped
                    * or been delivered.
                    */
                    $hasStartedShipping =
                        $sellerOrders->contains(
                            function ($sellerOrder) {
                                $status =
                                    $this->normalizeShippingStatus(
                                        $sellerOrder->shipping_status
                                    );

                                return in_array(
                                    $status,
                                    ['shipped', 'delivered'],
                                    true
                                );
                            }
                        );

                    if ($hasStartedShipping) {
                        throw ValidationException::withMessages([
                            'status' =>
                                'This order cannot be cancelled because one or more seller shipments have already been shipped or delivered.'
                        ]);
                    }

                } else {
                    /*
                    * Buyer may cancel only while every
                    * seller portion is still pending.
                    */
                    $sellerAlreadyProcessing =
                        $sellerOrders->contains(
                            fn ($sellerOrder) =>
                                $this->normalizeShippingStatus(
                                    $sellerOrder->shipping_status
                                ) !== 'pending'
                        );

                    if ($sellerAlreadyProcessing) {
                        throw ValidationException::withMessages([
                            'status' =>
                                'This order can no longer be cancelled because a seller has already started processing it.'
                        ]);
                    }
                }

            } else {
                /*
                * Legacy checkout fallback.
                */
                if ($isAdmin) {

                    if (
                        in_array(
                            $currentOverallStatus,
                            ['shipped', 'delivered'],
                            true
                        )
                    ) {
                        throw ValidationException::withMessages([
                            'status' =>
                                'This order cannot be cancelled because it has already been shipped or delivered.'
                        ]);
                    }

                } else {

                    if ($currentOverallStatus !== 'pending') {
                        throw ValidationException::withMessages([
                            'status' =>
                                'Only pending orders can be cancelled.'
                        ]);
                    }
                }
            }

            /*
            * Paid orders require a refund workflow.
            */
            if (
                $this->normalizePaymentStatus(
                    $checkout->payment_status
                ) === 'paid'
            ) {
                throw ValidationException::withMessages([
                    'payment_status' =>
                        'Paid orders cannot be cancelled directly. A refund process is required.'
                ]);
            }

            /*
            * Restore all checkout stock only once.
            */
            if (!$checkout->stock_restored_at) {

                $this->restoreCheckoutStock($checkout);

                $checkout->stock_restored_at = now();
            }

            $defaultReason = $isAdmin
                ? 'Cancelled by admin.'
                : 'Cancelled by buyer.';

            $reason = trim(
                (string) $request->input(
                    'reason',
                    $defaultReason
                )
            );

            if ($reason === '') {
                $reason = $defaultReason;
            }

            /*
            * Cancel every seller fulfillment record.
            */
            foreach ($sellerOrders as $sellerOrder) {

                $sellerOrder->shipping_status =
                    'cancelled';

                $sellerOrder->cancelled_at =
                    now();

                $sellerOrder->cancelled_by =
                    $user->user_id;

                $sellerOrder->cancellation_reason =
                    $reason;

                $sellerOrder->save();
            }

            /*
            * Cancel main checkout.
            */
            $checkout->shipping_status =
                'cancelled';

            $checkout->status =
                'cancelled';

            $checkout->payment_status =
                'cancelled';

            $checkout->cancelled_at =
                now();

            $checkout->cancelled_by =
                $user->user_id;

            $checkout->cancellation_reason =
                $reason;

            $checkout->save();

            return $checkout;
        });

        if (!$checkout) {
            return response()->json([
                'msg' => 'Checkout not found.'
            ], 404);
        }

        $checkout->load([
            'user',
            'items.product.brand',
            'items.product.seller',
            'items.seller',
            'sellerOrders.seller'
        ]);

        $sellerIds = $checkout->sellerOrders
            ->pluck('seller_id')
            ->filter()
            ->unique()
            ->values();

        /*
        * Notify all sellers.
        */
        foreach ($sellerIds as $sellerId) {

            $message =
                $user->role === 'admin'
                    ? 'Admin cancelled order #' .
                        $checkout->checkout_id . '.'
                    : 'A buyer cancelled order #' .
                        $checkout->checkout_id . '.';

            $this->sendPushSafely(
                $sellerId,
                'Order Cancelled',
                $message,
                'orderDetails.html',
                'order_cancelled',
                $checkout->checkout_id
            );
        }

        /*
        * If Admin cancelled the order,
        * notify the buyer too.
        */
        if ($user->role === 'admin') {

            $this->sendPushSafely(
                $checkout->user_id,
                'Order Cancelled',
                'Your order #' .
                    $checkout->checkout_id .
                    ' was cancelled by Admin.',
                'orderDetails.html',
                'order_cancelled',
                $checkout->checkout_id
            );
        }

        return response()->json([
            'msg' => 'Order cancelled successfully.',
            'checkout' => $this->formatOrder($checkout),
        ], 200);
    }

    /**
     * Admin/seller: Get orders.
     */
    public function getAllOrders(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);

        // User must be authenticated.
        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        // User must be active.
        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        // User must be admin or seller.
        if (!in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json(['msg' => 'Unauthorized'], 403);
        }

        $ordersQuery = Checkout::query()
            ->with('user')
            ->orderBy('created_at', 'DESC');

        if ($user->role === 'seller') {
            $ordersQuery
                ->whereHas('items', function ($itemsQuery) use ($user) {
                    $itemsQuery->where('seller_id', $user->user_id);
                })
                ->with([
                    'items' => function ($itemsQuery) use ($user) {
                        $itemsQuery
                            ->where('seller_id', $user->user_id)
                            ->with([
                                'product.brand',
                                'product.category',
                                'product.seller',
                                'seller'
                            ]);
                    },

                    'sellerOrders' => function ($sellerOrderQuery) use ($user) {
                        $sellerOrderQuery
                            ->where('seller_id', $user->user_id)
                            ->with('seller');
                    },
                ]);
        } else {
            $ordersQuery->with([
                'items.product.brand',
                'items.product.category',
                'items.product.seller',
                'items.seller',
                'sellerOrders.seller'
            ]);
        }

        $orders = $ordersQuery->get();

        return response()->json(
            $orders->map(fn ($order) => $this->formatOrder($order))->values(),
            200
        );
    }

    /**
     * Dashboard: Orders monthly.
     */
    public function ordersMonthly(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);

        if (
            !$user ||
            !in_array($user->role, ['admin', 'seller'], true)
        ) {
            return response()->json([
                'msg' => 'Unauthorized'
            ], 403);
        }

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        /*
        * Seller:
        * Count this Seller's own fulfillment records.
        */
       if ($user->role === 'seller') {

        $orders = CheckoutSellerOrder::where(
                'checkout_seller_orders.seller_id',
                $user->user_id
            )
            ->join(
                'checkouts',
                'checkouts.checkout_id',
                '=',
                'checkout_seller_orders.checkout_id'
            )
            ->selectRaw(
                'YEAR(checkouts.created_at) as year,
                MONTH(checkouts.created_at) as month,
                COUNT(*) as total'
            )
            ->groupBy('year', 'month')
            ->orderBy('year')
            ->orderBy('month')
            ->get();

        } else {

            /*
            * Admin:
            * Count overall checkouts.
            */
            $orders = Checkout::selectRaw(
                    'YEAR(created_at) as year,
                    MONTH(created_at) as month,
                    COUNT(*) as total'
                )
                ->groupBy('year', 'month')
                ->orderBy('year')
                ->orderBy('month')
                ->get();
        }

        $labels = [];
        $data = [];

        foreach ($orders as $order) {
            $labels[] = Carbon::create(
                $order->year,
                $order->month
            )->format('M Y');

            $data[] = $order->total;
        }

        return response()->json(
            compact('labels', 'data')
        );
    }

    /**
     * Dashboard: Orders by shipping status.
     */
    public function ordersByStatus(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);

        if (
            !$user ||
            !in_array($user->role, ['admin', 'seller'], true)
        ) {
            return response()->json([
                'msg' => 'Unauthorized'
            ], 403);
        }

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        /*
        * Seller dashboard:
        * Count the Seller's own fulfillment statuses.
        */
        if ($user->role === 'seller') {

            $orders = CheckoutSellerOrder::where(
                    'seller_id',
                    $user->user_id
                )
                ->selectRaw(
                    'shipping_status as status_label, COUNT(*) as total'
                )
                ->groupBy('shipping_status')
                ->get();

        } else {

            /*
            * Admin dashboard:
            * Count overall checkout statuses.
            */
            $orders = Checkout::selectRaw(
                    'COALESCE(shipping_status, status) as status_label, COUNT(*) as total'
                )
                ->groupBy('status_label')
                ->get();
        }

        return response()->json([
            'labels' => $orders
                ->pluck('status_label')
                ->values(),

            'data' => $orders
                ->pluck('total')
                ->values(),
        ]);
    }
}
