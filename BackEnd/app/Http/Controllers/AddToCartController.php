<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use App\Models\addToCart;
use App\Models\Product;


class AddToCartController extends Controller
{
    public function addToCart(Request $request)
    {
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
        if($user){

                $validated = $request->validate([
                    'product_id' => 'required|exists:products,product_id',
                    'quantity'   => 'required|integer|min:1',
                ]);

                $cartItem = addToCart::where('user_id', $user->user_id)
                    ->where('product_id', $validated['product_id'])
                    ->first();

                if ($cartItem) {
                        // if already in cart, same product in my cart
                        $cartItem->quantity += $validated['quantity'];
                        $cartItem->save();

                    } else {
                        // Create a new cart item
                        $cartItem = addToCart::create([
                            'user_id'    => $user->user_id,
                            'product_id' => $validated['product_id'],
                            'quantity'   => $validated['quantity'],
                        ]);
                    }

                    // Fetch full cart with product details
                    $cart = AddToCart::where('user_id', $user->user_id)
                        ->join('products', 'products.product_id', '=', 'add_to_cart.product_id')
                        ->select(
                            'add_to_cart.addToCart_id',
                            'products.product_name',
                            'products.product_price',
                            'products.image',
                            'add_to_cart.quantity',
                            \DB::raw('products.product_price * add_to_cart.quantity as subtotal')
                        )
                        ->get();

                    // Calculate total amount
                    $total = $cart->sum('subtotal');

                    return response()->json([
                        'message' => 'Cart items fetched successfully',
                        'cart'    => $cart, 
                        'count'   => $cart->count(),
                        'total'   => $total 
                    ]);
            } else {
                return response()->json([
                    'msg' => 'Invalid Token.'
                ], 400);
            }
        } else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }

    // Remove item from cart
    public function removeFromCart(Request $request, $id)
    {
        $token = request()->bearerToken();
        if (!$token) {
            return response()->json(['msg' => 'Token is required.'], 401);
        }
        if ($token) {
            $user = User::where('token', $token)->first();
            if (!$user) {
                return response()->json(['msg' => 'Invalid Token.'], 401);
            } else {
                $cartItem = addToCart::find($id);
                if (!$cartItem) {
                    return response()->json(['msg' => 'Cart item not found.'], 404);
                } else {
                    $cartItem->delete();
                    return response()->json(['message' => 'Product removed from cart', 'status' => 200]);
                }
            }
        } else {
            return response()->json(['msg' => 'No Token Provided.'], 401);
        }
    }

    // Update quantity
    public function updateCart(Request $request, $id)
    {
        $token = request()->bearerToken();
        if ($token) {
            $user = User::where('token', $token)->first();
            if ($user) {
                $addToCart = addToCart::find($id);
                if (!$addToCart) {
                    return response()->json(['msg' => 'Brand not found.'], 404);
                }

                $request->validate([
                    'quantity' => 'required|integer|min:1',
                ]);

                $addToCart->quantity = $request->quantity;
                $addToCart->save();
                return response()->json(['message' => 'Cart updated successfully', 'cart' => $addToCart, 'status' => 200]);
            } else {
                return response()->json(['msg' => 'Invalid Token.'], 400);
            }
        } else {
            return response()->json(['msg' => 'No Token Provided.'], 400);
        }

        // $request->validate([
        //     'quantity' => 'required|integer|min:1',
        // ]);

        // $cartItem = Cart::where('user_id', Auth::id())->findOrFail($id);
        // $cartItem->quantity = $request->quantity;
        // $cartItem->save();

        // return response()->json([
        //     'message' => ' Cart updated',
        //     'cart'    => $cartItem
        // ]);
    }

    // Get all cart items for the user
    public function getCart (Request $request)
{
    $token = $request->bearerToken();
    if ($token) {
        $user = User::where('token', $token)->first();
        if ($user) {
            $cartItems = AddToCart::where('user_id', $user->user_id)->get();
            $cartCount = AddToCart::where('user_id', $user->user_id)->count();

            $cartItems = AddToCart::with('product') // eager load product
            ->where('user_id', $user->user_id)
            ->get();

            return response()->json([
                'message' => 'Cart items fetched successfully',
                'cart'    => $cartItems,
                'count'   => $cartItems->count(),
                'total'   => $cartItems->sum(function ($item) {
                    return $item->quantity * $item->product->product_price;
                }),
            ]);
        }
        return response()->json(['msg' => 'Invalid Token.'], 400);
    }
    return response()->json(['msg' => 'No Token Provided.'], 400);
}
}