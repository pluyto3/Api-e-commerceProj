<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\Category;
use App\Models\Checkout;
use App\Models\User;

class DashboardController extends Controller
{
     public function sellerDashboard(Request $request)
    {
        $token = $request->bearerToken();
        $user = $token ? User::where('token', $token)->first() : null;

        if (!$user || $user->role !== 'seller') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $sellerId = $user->user_id;

        $products = Product::where('seller_id', $sellerId)->get();

        $orders = Checkout::whereHas('items.product', function ($q) use ($sellerId) {
            $q->where('seller_id', $sellerId);
        })->with('items.product')->get();

        $revenue = 0;
        foreach ($orders as $order) {
            foreach ($order->items as $item) {
                if ($item->product->seller_id == $sellerId) {
                    $revenue += $item->price * $item->quantity;
                }
            }
        }

        return response()->json([
            'products' => $products->count(),
            'pending' => $products->where('approval_status', 'pending')->count(),
            'low_stock' => $products
                ->where('stock_quantity', '>', 0)
                ->where('stock_quantity', '<=', 5)
                ->count(),
            'orders' => $orders->count(),
            'revenue' => $revenue
        ]);
    }
}
