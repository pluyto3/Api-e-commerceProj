<?php

namespace App\Http\Controllers;

use App\Models\addToCart;
use App\Models\Checkout;
use App\Models\CheckoutItem;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

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

    private function ensureCheckoutItemsCanBePurchased($cartItems, $products): void
    {
        foreach ($cartItems as $item) {
            $product = $products->get($item->product_id);
            $quantity = (int) $item->quantity;

            if (!$product) {
                throw ValidationException::withMessages([
                    'item_ids' => 'One of the selected products no longer exists.',
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
     * Create checkout, order items, and stock deduction atomically.
     */
    public function createCheckout(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json(['msg' => 'Invalid or missing token.'], 401);
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

        $checkout = DB::transaction(function () use ($request, $user, $selectedIds, $validated) {
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
            $products = Product::whereIn('product_id', $productIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('product_id');

            $this->ensureCheckoutItemsCanBePurchased($cartItems, $products);

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

                $this->reduceProductStock($product, $quantity);
            }

            addToCart::where('user_id', $user->user_id)
                ->whereIn('addTocart_id', $selectedIds)
                ->delete();

            return $checkout;
        });

        $checkout->load(['user', 'items.product.brand', 'items.product.seller', 'items.seller']);
        $formatted = $this->formatOrder($checkout);

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

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        $orders = Checkout::with(['user', 'items.product.brand', 'items.product.seller', 'items.seller'])
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

        if (!$user) {
            return response()->json(['message' => 'Invalid Token'], 401);
        }

        $order = Checkout::with(['user', 'items.product.brand', 'items.product.seller', 'items.seller'])
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
     * Update shipping/payment status for admin or seller.
     */
    public function updateStatus(Request $request, $checkout_id)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        if (!in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json(['msg' => 'Unauthorized'], 403);
        }

        $incomingShipping = $request->input('shipping_status', $request->input('status'));
        $incomingPayment = $request->input('payment_status');
        $incomingTracking = trim((string) $request->input('tracking_number', ''));

        if (!$incomingShipping && !$incomingPayment && $incomingTracking === '') {
            return response()->json(['msg' => 'Please provide a shipping status, payment status, or tracking number.'], 422);
        }

        $shippingStatus = $incomingShipping ? $this->normalizeShippingStatus($incomingShipping) : null;
        $paymentStatus = $incomingPayment ? $this->normalizePaymentStatus($incomingPayment) : null;

        if ($shippingStatus && !in_array($shippingStatus, self::SHIPPING_STATUSES, true)) {
            return response()->json(['msg' => 'Invalid shipping status value.'], 422);
        }

        if ($paymentStatus && !in_array($paymentStatus, self::PAYMENT_STATUSES, true)) {
            return response()->json(['msg' => 'Invalid payment status value.'], 422);
        }

        if ($incomingTracking !== '' && strlen($incomingTracking) > 100) {
            return response()->json(['msg' => 'Tracking number may not be greater than 100 characters.'], 422);
        }

        $checkoutForAuth = Checkout::find($checkout_id);
        if (!$checkoutForAuth) {
            return response()->json(['msg' => 'Checkout not found.'], 404);
        }

        if ($user->role === 'seller' && !$this->canSellerAccessCheckout($checkoutForAuth, $user)) {
            return response()->json(['msg' => 'Unauthorized'], 403);
        }

        if ($user->role === 'seller' && $paymentStatus) {
            return response()->json(['msg' => 'Sellers can update shipping status only.'], 403);
        }

        $checkout = DB::transaction(function () use ($request, $checkout_id, $user, $shippingStatus, $paymentStatus, $incomingTracking) {
            $checkout = Checkout::where('checkout_id', $checkout_id)
                ->lockForUpdate()
                ->first();

            if (!$checkout) {
                return null;
            }

            $currentShipping = $this->normalizeShippingStatus($checkout->shipping_status ?: $checkout->status);

            if ($currentShipping === 'cancelled' && $shippingStatus !== 'cancelled') {
                throw ValidationException::withMessages([
                    'shipping_status' => 'Cancelled orders cannot be moved back to active shipping statuses.',
                ]);
            }

            if ($currentShipping === 'delivered' && (($shippingStatus && $shippingStatus !== 'delivered') || $paymentStatus || $incomingTracking !== '')) {
                throw ValidationException::withMessages([
                    'shipping_status' => 'Delivered orders are final and cannot be changed.',
                ]);
            }

            if ($shippingStatus) {
                $checkout->shipping_status = $shippingStatus;

                if ($shippingStatus === 'shipped' && empty($checkout->tracking_number)) {
                    $checkout->tracking_number = $this->generateTrackingNumber($checkout->checkout_id);
                }

                if ($shippingStatus === 'delivered' && $checkout->payment_method === 'cod' && $checkout->payment_status === 'pending') {
                    $checkout->payment_status = 'paid';
                }

                if ($shippingStatus === 'cancelled') {
                    if (!$checkout->cancelled_at) {
                        $this->restoreCheckoutStock($checkout);
                    }

                    $checkout->cancelled_at = now();
                    $checkout->cancelled_by = $user->user_id;
                    $checkout->cancellation_reason = $request->input('reason', $checkout->cancellation_reason);

                    if ($checkout->payment_status !== 'paid') {
                        $checkout->payment_status = 'cancelled';
                    }
                }
            }

            if ($incomingTracking !== '') {
                $trackingAllowedStatus = $shippingStatus ?: $currentShipping;

                if (!in_array($trackingAllowedStatus, ['packed', 'shipped'], true)) {
                    throw ValidationException::withMessages([
                        'tracking_number' => 'Tracking number can only be updated when the order is packed or shipped.',
                    ]);
                }

                $checkout->tracking_number = $incomingTracking;
            }

            if ($paymentStatus) {
                $checkout->payment_status = $paymentStatus;

                if (in_array($paymentStatus, ['failed', 'cancelled'], true) && $this->normalizeShippingStatus($checkout->shipping_status) !== 'cancelled') {
                    if (!$checkout->cancelled_at) {
                        $this->restoreCheckoutStock($checkout);
                    }

                    $checkout->shipping_status = 'cancelled';
                    $checkout->cancelled_at = now();
                    $checkout->cancelled_by = $user->user_id;
                    $checkout->cancellation_reason = $request->input('reason', 'Payment was ' . $paymentStatus . '.');
                }
            }

            $this->syncLegacyStatus($checkout);
            $checkout->save();

            return $checkout;
        });

        if (!$checkout) {
            return response()->json(['msg' => 'Checkout not found.'], 404);
        }

        $checkout->load(['user', 'items.product.brand', 'items.product.seller', 'items.seller']);

        return response()->json([
            'msg' => 'Order status updated successfully.',
            'checkout' => $this->formatOrder($checkout),
        ], 200);
    }

    private function generateTrackingNumber($checkout_id): string
    {
        return 'TRK-' . now()->format('Ymd') . '-' . str_pad($checkout_id, 6, '0', STR_PAD_LEFT);
    }

    /**
     * Buyer cancel order.
     */
    public function cancelOrder(Request $request, $checkout_id)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        $checkout = DB::transaction(function () use ($request, $checkout_id, $user) {
            $checkout = Checkout::where('checkout_id', $checkout_id)
                ->where('user_id', $user->user_id)
                ->lockForUpdate()
                ->first();

            if (!$checkout) {
                return null;
            }

            $shippingStatus = $this->normalizeShippingStatus($checkout->shipping_status ?: $checkout->status);

            if ($shippingStatus !== 'pending') {
                throw ValidationException::withMessages([
                    'status' => 'Only pending orders can be cancelled.',
                ]);
            }

            if ($checkout->payment_status === 'paid') {
                throw ValidationException::withMessages([
                    'payment_status' => 'Paid orders need admin assistance before cancellation.',
                ]);
            }

            if (!$checkout->cancelled_at) {
                $this->restoreCheckoutStock($checkout);
            }

            $checkout->shipping_status = 'cancelled';
            $checkout->status = 'cancelled';
            $checkout->payment_status = 'cancelled';
            $checkout->cancelled_at = now();
            $checkout->cancelled_by = $user->user_id;
            $checkout->cancellation_reason = $request->input('reason', 'Cancelled by buyer.');
            $checkout->save();

            return $checkout;
        });

        if (!$checkout) {
            return response()->json(['msg' => 'Checkout not found.'], 404);
        }

        $checkout->load(['user', 'items.product.brand', 'items.product.seller', 'items.seller']);

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

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        if (!in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json(['msg' => 'Unauthorized'], 403);
        }

        $ordersQuery = Checkout::query()
            ->with('user')
            ->orderBy('created_at', 'DESC');

        if ($user->role === 'seller') {
            $ordersQuery->whereHas('items', function ($itemsQuery) use ($user) {
                $itemsQuery->where('seller_id', $user->user_id);
            })->with([
                'items' => function ($itemsQuery) use ($user) {
                    $itemsQuery->where('seller_id', $user->user_id)
                        ->with(['product.brand', 'product.category', 'product.seller', 'seller']);
                },
            ]);
        } else {
            $ordersQuery->with(['items.product.brand', 'items.product.category', 'items.product.seller', 'items.seller']);
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

        if (!$user || !in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json(['msg' => 'Unauthorized'], 403);
        }

        $query = Checkout::query();

        if ($user->role === 'seller') {
            $query->whereHas('items', function ($q) use ($user) {
                $q->where('seller_id', $user->user_id);
            });
        }

        $orders = $query->selectRaw('YEAR(created_at) as year, MONTH(created_at) as month, COUNT(*) as total')
            ->groupBy('year', 'month')
            ->orderBy('year')
            ->orderBy('month')
            ->get();

        $labels = [];
        $data = [];

        foreach ($orders as $order) {
            $labels[] = Carbon::create($order->year, $order->month)->format('M Y');
            $data[] = $order->total;
        }

        return response()->json(compact('labels', 'data'));
    }

    /**
     * Dashboard: Orders by shipping status.
     */
    public function ordersByStatus(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user || !in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json(['msg' => 'Unauthorized'], 403);
        }

        $query = Checkout::query();

        if ($user->role === 'seller') {
            $query->whereHas('items', function ($q) use ($user) {
                $q->where('seller_id', $user->user_id);
            });
        }

        $orders = $query->selectRaw('COALESCE(shipping_status, status) as status_label, COUNT(*) as total')
            ->groupBy('status_label')
            ->get();

        return response()->json([
            'labels' => $orders->pluck('status_label')->values(),
            'data' => $orders->pluck('total')->values(),
        ]);
    }
}
