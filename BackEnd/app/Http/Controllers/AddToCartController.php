<?php

namespace App\Http\Controllers;

use App\Models\addToCart;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;

class AddToCartController extends Controller
{
    private function userFromToken(Request $request): ?User
    {
        $token = $request->bearerToken();

        if (!$token) {
            return null;
        }

        return User::where('token', $token)->first();
    }

    private function missingTokenResponse()
    {
        return response()->json(['msg' => 'No Token Provided.'], 400);
    }

    private function invalidTokenResponse()
    {
        return response()->json(['msg' => 'Invalid Token.'], 400);
    }

    private function cartResponse(User $user, string $message = 'Cart items fetched successfully', int $status = 200)
    {
        $cartItems = addToCart::with([
            'product' => function ($query) {
                $query->select(
                    'product_id',
                    'product_name',
                    'product_price',
                    'stock_quantity',
                    'image',
                    'status',
                    'approval_status',
                    'seller_id'
                );
            },
        ])
            ->where('user_id', $user->user_id)
            ->get();

        $cartItems->each(function ($item) {
            $item->setAttribute(
                'subtotal',
                $item->product ? $item->quantity * $item->product->product_price : 0
            );
            $item->setAttribute(
                'is_available',
                $item->product
                    && $item->product->approval_status === 'approved'
                    && $item->product->status === 'active'
                    && (int) $item->product->stock_quantity >= (int) $item->quantity
            );
        });

        return response()->json([
            'message' => $message,
            'cart'    => $cartItems,
            'count'   => $cartItems->count(),
            'total'   => $cartItems->sum('subtotal'),
        ], $status);
    }

    public function addToCart(Request $request)
    {
        if (!$request->bearerToken()) {
            return $this->missingTokenResponse();
        }

        $user = $this->userFromToken($request);
        if (!$user) {
            return $this->invalidTokenResponse();
        }

        $validated = $request->validate([
            'product_id' => 'required|exists:products,product_id',
            'quantity'   => 'required|integer|min:1',
        ]);

        $product = Product::find($validated['product_id']);
        if (!$product) {
            return response()->json(['msg' => 'Product not found.'], 404);
        }

        if (($product->approval_status ?? 'pending') !== 'approved' || ($product->status ?? 'active') !== 'active') {
            return response()->json([
                'msg' => 'This product is not available for purchase.',
            ], 422);
        }

        $stock = (int) $product->stock_quantity;
        if ($stock <= 0) {
            return response()->json([
                'msg' => 'This product is out of stock.',
            ], 422);
        }

        $cartItem = addToCart::where('user_id', $user->user_id)
            ->where('product_id', $validated['product_id'])
            ->first();

        $requestedQuantity = (int) $validated['quantity'];
        if ($cartItem) {
            $requestedQuantity += (int) $cartItem->quantity;
        }

        if ($requestedQuantity > $stock) {
            return response()->json([
                'msg' => "Only {$stock} item(s) available in stock.",
            ], 422);
        }

        if ($cartItem) {
            $cartItem->quantity = $requestedQuantity;
            $cartItem->save();
        } else {
            addToCart::create([
                'user_id'    => $user->user_id,
                'product_id' => $validated['product_id'],
                'quantity'   => $requestedQuantity,
            ]);
        }

        return $this->cartResponse($user, 'Product added to cart successfully.');
    }

    public function removeFromCart(Request $request, $id)
    {
        if (!$request->bearerToken()) {
            return response()->json(['msg' => 'Token is required.'], 401);
        }

        $user = $this->userFromToken($request);
        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        $cartItem = addToCart::where('user_id', $user->user_id)
            ->where('addTocart_id', $id)
            ->first();

        if (!$cartItem) {
            return response()->json(['msg' => 'Cart item not found.'], 404);
        }

        $cartItem->delete();

        return response()->json([
            'msg' => 'Product removed from cart',
            'message' => 'Product removed from cart',
            'status' => 200,
        ]);
    }

    public function updateCart(Request $request, $id)
    {
        if (!$request->bearerToken()) {
            return $this->missingTokenResponse();
        }

        $user = $this->userFromToken($request);
        if (!$user) {
            return $this->invalidTokenResponse();
        }

        $validated = $request->validate([
            'quantity' => 'required|integer|min:1',
        ]);

        $cartItem = addToCart::with('product')
            ->where('user_id', $user->user_id)
            ->where('addTocart_id', $id)
            ->first();

        if (!$cartItem) {
            return response()->json(['msg' => 'Cart item not found.'], 404);
        }

        $product = $cartItem->product ?: Product::find($cartItem->product_id);
        if (!$product) {
            return response()->json(['msg' => 'Product not found.'], 404);
        }

        if (($product->approval_status ?? 'pending') !== 'approved' || ($product->status ?? 'active') !== 'active') {
            return response()->json([
                'msg' => 'This product is not available for purchase.',
            ], 422);
        }

        $stock = (int) $product->stock_quantity;
        if ($stock <= 0) {
            return response()->json([
                'msg' => 'This product is out of stock.',
            ], 422);
        }

        if ((int) $validated['quantity'] > $stock) {
            return response()->json([
                'msg' => "Only {$stock} item(s) available in stock.",
            ], 422);
        }

        $cartItem->quantity = (int) $validated['quantity'];
        $cartItem->save();

        return response()->json([
            'message' => 'Cart updated successfully',
            'cart' => $cartItem->fresh('product'),
            'status' => 200,
        ]);
    }

    public function getCart(Request $request)
    {
        if (!$request->bearerToken()) {
            return $this->missingTokenResponse();
        }

        $user = $this->userFromToken($request);
        if (!$user) {
            return $this->invalidTokenResponse();
        }

        return $this->cartResponse($user);
    }
}
