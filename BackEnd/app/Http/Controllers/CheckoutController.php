<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\addToCart;
use App\Models\Checkout;
use App\Models\CheckoutItem;
use Carbon\Carbon;


class CheckoutController extends Controller
{
    /**
     * Create Checkout
     */
    public function createCheckout(Request $request)
    {
        $token = $request->bearerToken();
        if ($token) {
            $user = User::where('token', $token)->first();
            if ($user) {
                $request->validate([
                    'payment_method' => 'required|string',
                    'purok'          => 'required|string|max:50',
                    'barangay'       => 'required|string|max:100',
                    'city'           => 'required|string|max:100',
                    'province'       => 'required|string|max:100',
                    'zipcode'        => 'required|string|max:10',
                    'phone'   => 'required|string|max:20',
                    'total_amount'   => 'required|numeric|min:0',
                    'item_ids'       => 'required|array|min:1',
                    'item_ids.*'     => 'integer|exists:add_to_cart,addTocart_id',
                ]);

                $checkout = new Checkout();
                $checkout->user_id = $user->user_id;
                $checkout->payment_method = $request->payment_method;
                $checkout->purok = $request->purok;
                $checkout->barangay = $request->barangay;
                $checkout->city = $request->city;
                $checkout->province = $request->province;
                $checkout->zipcode = $request->zipcode;
                $checkout->phone_number = $request->phone;
                $checkout->total_amount = $request->total_amount;
                $checkout->status = 'pending'; 
                $checkout->save();

                // Only fetch selected cart items
                $selectedIds = $request->item_ids;

                // Get cart items for the user
                $cartItems = addToCart::where('user_id', $user->user_id)
                    ->with('product')
                    ->whereIn('addTocart_id', $selectedIds)
                    ->get();

                if ($cartItems->isEmpty()) {
                    return response()->json(['msg' => 'No valid selected cart items found.'], 400);
                }

                // Create checkout items
                foreach ($cartItems as $item) {
                    CheckoutItem::create([
                        'checkout_id' => $checkout->checkout_id,
                        'product_id'  => $item->product_id,
                        'seller_id'   => $item->product?->seller_id,
                        'quantity'    => $item->quantity,
                        'price'       => $item->product->product_price, 
                        'subtotal'    => $item->quantity * $item->product->product_price,
                    ]);
                }   

                // Clear the user's cart after checkout
                addToCart::where('user_id', $user->user_id)
                    ->whereIn('addTocart_id', $selectedIds)
                    ->delete();

                return response()->json([
                'message'  => 'Checkout created successfully',
                    'checkout' => $checkout,
                    'items'    => $cartItems->map(function ($item) {
                        return [
                            'product_id' => $item->product_id,
                            'product_name' => $item->product->product_name,
                            'quantity' => $item->quantity,
                            'price' => $item->product->product_price,
                            'subtotal' => $item->quantity * $item->product->product_price,
                        ];
                    }),
                ], 201);
            } else {
                return response()->json(['msg' => 'Invalid Token.'], 400);
            }
        } else {
            return response()->json(['msg' => 'No Token Provided.'], 401);
        }
    }

    /**
     * Fetch Buyer Orders
     */
    public function getUserOrders(Request $request)
    {
        $token = $request->bearerToken();
        $user = User::where('token', $token)->first();

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        // Load all checkouts with their items and product details
        $orders = Checkout::with(['user', 'items.product.brand', 'items.product.seller', 'items.seller'])
            ->where('user_id', $user->user_id)
            ->orderBy('checkout_id', 'DESC')
            ->get();

        $formattedOrders = $orders->map(function ($order) {

            $sellerNames = $order->items
                ->map(function ($item) {
                    return $item->seller?->username
                        ?? $item->product?->seller?->username
                        ?? null;
                })
                ->filter()
                ->unique()
                ->values();

            $shopName = $sellerNames->isNotEmpty()
                ? $sellerNames->implode(', ')
                : 'Unknown Shop';

            return [
                'checkout_id'  => $order->checkout_id,
                'user_id'      => $order->user_id,
                'user'         => $order->user ? [
                    'user_id' => $order->user->user_id,
                    'username' => $order->user->username,
                    'fullname' => $order->user->fullname,
                    'email' => $order->user->email,
                ] : null,
                'status'       => $order->status,
                'total_amount' => $order->total_amount,
                'tracking_number' => $order->tracking_number,
                'created_date' => Carbon::parse($order->created_at)->toDateString(),
                'created_at'   => Carbon::parse($order->created_at)->format('M d, Y'),

                // Additional summary
                'item_count'   => $order->items->count(),
                'shop_name'    => $shopName,

                // Items inside each checkout
                'items'        => $order->items->map(function ($item) {

                // FIX: Correct image path
                $imagePath = $item->product?->image
                    ? 'FrontEnd/assets/img/product/' . $item->product->image
                    : 'assets/img/back.jpg';

                    return [
                        // Extract the product details
                        'product_id'   => $item->product_id,    
                        'product_name' => $item->product ? $item->product->product_name : 'Unknown Product',
                        'quantity'     => $item->quantity,
                        'price'        => $item->price,
                        'subtotal'     => $item->subtotal,
                        'seller_name'  => $item->seller?->username ?? $item->product?->seller?->username,
                        'image'        => $imagePath
                    ];
                }),
            ];
            
        });

        return response()->json([
            'data' => $formattedOrders
        ], 200);
    }

    /**
     * Get a single checkout with items
     */
    public function getOrderDetails($checkout_id)
    {
        $token = request()->bearerToken();
        $user = User::where('token', $token)->first();

        if (!$user) {
            return response()->json(['message' => 'Invalid Token'], 401);
        }

        // Fetch checkout with related items, products, and user
        $order = Checkout::with(['user', 'items.product.brand'])
            ->where('checkout_id', $checkout_id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        $formatted = [
            'checkout_id'  => $order->checkout_id,
            'user_id'      => $order->user_id,
            'user'         => $order->user ? [
                'user_id' => $order->user->user_id,
                'username' => $order->user->username,
                'fullname' => $order->user->fullname,
                'email' => $order->user->email,
            ] : null,
            'status'       => $order->status,
            'tracking_number' => $order->tracking_number,
            'total_amount' => $order->total_amount,
            'created_at'   => Carbon::parse($order->created_at)->format('M d, Y'),
            'purok'        => $order->purok,
            'barangay'     => $order->barangay,
            'city'         => $order->city,
            'province'     => $order->province,
            'zipcode'      => $order->zipcode,
            'item_count'   => $order->items->count(),
            'shop_name'    => $order->items->first()?->product?->brand?->name ?? "Unknown Shop",

            // Items inside the checkout
            'items' => $order->items->map(function ($item) {

                // FIX: Correct image path
                $imagePath = $item->product?->image
                    ? 'FrontEnd/assets/img/product/' . $item->product->image
                    : 'assets/img/back.jpg';

                return [
                    'product_id'   => $item->product_id,    
                    'product_name' => $item->product ? $item->product->product_name : 'Unknown Product',
                    'quantity'     => $item->quantity,
                    'price'        => $item->price,
                    'subtotal'     => $item->subtotal,
                    'image'        => $imagePath
                ];
            }),
        ];

        return response()->json([
            'order' => $formatted,
            'items' => $formatted['items']
        ], 200);
    }

    /**
     * Update Order Status (Admin)
     */
    public function updateStatus(Request $request, $checkout_id)
    {
        $token = $request->bearerToken();
        $user = User::where('token', $token)->first();

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        $status = strtolower(trim((string) $request->input('status')));
        $status = str_replace('_', ' ', $status);

        if (!in_array($status, ['pending', 'to ship', 'shipped', 'completed'], true)) {
            return response()->json([
                'msg' => 'Invalid status value.',
            ], 422);
        }
        
        // Restrict to admin and seller only
        if (!in_array($user->role, ['admin', 'seller'])) {
            return response()->json(['msg' => 'Unauthorized'], 403);
        }

        $checkout = Checkout::find($checkout_id);

        if (!$checkout) {
            return response()->json(['msg' => 'Checkout not found.'], 404);
        }

        if (
            $user->role === 'seller' &&
            !$checkout->items()->where('seller_id', $user->user_id)->exists()
        ) {
            return response()->json(['msg' => 'Unauthorized'], 403);
        }

        // Generate tracking number the first time an order is marked as shipped.
        if ($status === 'shipped' && empty($checkout->tracking_number)) {
            $checkout->tracking_number = $this->generateTrackingNumber($checkout->checkout_id);
        }

        $checkout->status = $status;
        $checkout->save();

        return response()->json([
            'msg' => 'Checkout status updated successfully.',
            'checkout' => $checkout->fresh(),
        ], 200);
    }

    /**
     * Logic for Generating Tracking Number
     */
    private function generateTrackingNumber($checkout_id)
    {
        return 'TRK-' . now()->format('Ymd') . '-' . str_pad($checkout_id, 6, '0', STR_PAD_LEFT);
    }

    /**
     * Buyer Cancel Order
     */
    public function cancelOrder(Request $request, $checkout_id)
    {
        $token = $request->bearerToken();
        $user = User::where('token', $token)->first();

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        $checkout = Checkout::where('checkout_id', $checkout_id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$checkout) {
            return response()->json(['msg' => 'Checkout not found.'], 404);
        }

        if ($checkout->status !== 'pending') {
            return response()->json(['msg' => 'Only pending orders can be canceled.'], 400);
        }

        $checkout->status = 'cancelled';
        $checkout->save();

        return response()->json(['msg' => 'Order cancelled successfully.', 'checkout' => $checkout], 200);
    }

    /**
     * ADMIN: Get All Orders
     */
    public function getAllOrders(Request $request)
    {
        $token = $request->bearerToken();
        $user = User::where('token', $token)->first();

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        // Restrict to admin users only
        if (!in_array($user->role, ['admin', 'seller'])) {
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
                        ->with('product.seller');
                }
            ]);
        } else {
            $ordersQuery->with('items.product.seller');
        }

        $orders = $ordersQuery->get();

        return response()->json($orders, 200);
    }

    /**
     * Dashboard: Orders Monthly
     */
    public function ordersMonthly(Request $request)
    {
        $user = User::where('token', $request->bearerToken())->first();

        if (!$user || !in_array($user->role, ['admin', 'seller'])) {
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
     * Dashboard: Orders By Status
     */
    public function ordersByStatus(Request $request)
    {
        $user = User::where('token', $request->bearerToken())->first();

        if (!$user || !in_array($user->role, ['admin', 'seller'])) {
            return response()->json(['msg' => 'Unauthorized'], 403);
        }

        $query = Checkout::query();
        if ($user->role === 'seller') {
            $query->whereHas('items', function ($q) use ($user) {
                $q->where('seller_id', $user->user_id);
            });
        }

         $orders = $query->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->get();

        return response()->json([
            'labels' => $orders->pluck('status')->values(),
            'data'   => $orders->pluck('total')->values(),
        ]);
    }
}
