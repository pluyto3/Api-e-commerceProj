<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Order;
use App\Models\Location;
use App\Models\OrderItems;
use App\Models\Product;
use Illuminate\Http\Request;
use Carbon\Carbon;

class OrderController extends Controller
{
    
    /**
     * Display a listing of the Order in pagination.
     *
     * 
     */
    public function index(Request $request) {
        $token = request()->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){ 
                if ($orders) {
                     $orders = Order::where('user_id', $user->userid)->get();

                if ($orders->isNotEmpty()) {
                    // Optional: Format the data if needed, or return as is
                    return response()->json(['data' => $orders], 200);
                } else {
                    return response()->json([
                        'msg' => 'No orders found.'
                    ], 400);
                }

                } else {
                    return response()->json([
                        'msg' => 'No orders found.'
                    ], 400);
                }
                
            } else {
                return response()->json([
                    'msg' => 'No Users.'
                ], 400);
            }
        } else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }

    /**
     * Show Order by id
     */

    public function get_order_id(Request $request, $id) {
        $token = request()->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){ 
                $order = Order::find($id);
                return response()->json($order, 200);
                
            } else {
                return response()->json([
                    'msg' => 'No Users.'
                ], 400);
            }
        } else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }
   
    /**
     * Order create
     */
    public function createOrder(Request $request){
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $location = Location::where('user_id', $user->id)->first();

                $request->validate([
                    'order_items' => 'required',
                    'total_price' => 'required|numeric|min:0',
                    'quantity' => 'required|integer|min:1',
                    'date_of_delivery' => 'required|date',
                ]);
                $order = new Order();
                $order->user_id = $user->userid;
                $order->location_id = $location->location_id;
                $order->total_price = $request->total_price;
                $order->date_of_delivery = $request->date_of_delivery;
                $order->status = 'pending';
                $order->save();

                foreach ($request->order_items as $order_items) {
                    $items = new OrderItems();
                    $items->order_id = $order->order_id;
                    $items->product_id = $order_items['product_id'];
                    $items->quantity = $order_items['quantity'];
                    $items->price = $order_items['price'];
                    $items->save();

                    $product = Product::find($order_items['product_id']);
                    if ($product) {
                        $product->stock_quantity -= $order_items['quantity'];
                        $product->save();
                    }

                }
                return response()->json([
                    'msg' => 'New Order was successfully saved.'
                ], 201);
            }
            else {
                return response()->json([
                    'msg' => 'Invalid Token.'
                ], 400);
            }
        }
        else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }


    /**
     * Get Order Items by id
     */
    public function get_order_items(Request $request, $id){
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $order_items = OrderItems::where('order_id', $id)->get();
                if($order_items->isNotEmpty()) {
                    foreach ($order_items as $order_item) {
                        $product = Product::where('product_id', $order_item->product_id)->pluck('product_name');
                        $order_item->product_name = $product['0'];
                    }
                    return response()->json($order_items, 200);
                } else {
                    return response()->json([
                        'msg' => 'No Order Items found.'
                    ], 400);
                }
            }
            else {
                return response()->json([
                    'msg' => 'Invalid Token.'
                ], 400);
            }
        }
        else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }

    /**
     * GET USER ORDERS
     */
    public function get_user_orders (Request $request) {
        $token = $request->bearerToken();
        if($token){ 
            $user = User::where('token', $token)->first();
            if($user){
                $orders = Order::where('user_id', $user->id)
                ->with(['Items.product.brand'])
                ->orderBy('created_at', 'desc')
                ->get();
                if ($orders->isNotEmpty()) {
                    $formattedOrders = $orders->map(function ($order) {
                        $firstItem = $order->Items->first();
                        $shopName = 'Unknown Shop';
                        if ($firstItem && $firstItem->product && $firstItem->product->brand) {
                            $shopName = $firstItem->product->brand->name;
                        }
                        return [
                            'checkout_id' => $order->order_id,
                            'status' => $order->status,
                            'total_amount' => $order->total_price,
                            'created_at' => Carbon::parse($order->created_at)->format('M d'),
                            'shop_name' => $shopName,
                            'items' => $order->Items->map(function ($item) {
                                return [
                                    'product_name' => $item->product ? $item->product->product_name : 'Unknown Product',
                                    'image' => $item->product ? $item->product->image : null,
                                    'quantity' => $item->quantity,
                                    'price' => $item->product ? $item->product->product_price : $item->price,
                                ];
                            }),
                        ];
                    });

                    return response()->json(['data' => $formattedOrders], 200);
                } else {
                    return response()->json([
                        'msg' => 'No orders found for this user.'
                    ], 400);
                }
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

    /**
     * Change Order Status
     */

    public function change_order_status(Request $request, $id) {
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $order = Order::find($id);
                if ($order) {
                    $order->update([
                        'status' => $request->status
                    ]);
                    return response()->json([
                        'msg' => 'Order status was successfully updated.'
                    ], 200);
                } else {
                    return response()->json([
                        'msg' => 'Order not found.'
                    ], 404);
                }
            }
            else {
                return response()->json([
                    'msg' => 'Invalid Token.'
                ], 400);
            }
        }
        else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }

}
