<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\Category;
use App\Models\Checkout;

class DashboardController extends Controller
{
     public function sellerDashboard(Request $request)
    {
        if (auth()->user()->role !== 'seller') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $sellerId = auth()->id();

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
            'orders' => $orders->count(),
            'revenue' => $revenue
        ]);
    }
}
