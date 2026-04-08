<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\File;
use Illuminate\Http\FileException;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    private function getAuthenticatedUser(Request $request): ?User
    {
        $token = $request->bearerToken();
        if (!$token) {
            return null;
        }

        return User::where('token', $token)->first();
    }

    private function canViewAllProducts(?User $user): bool
    {
        return $user && in_array($user->role, ['admin', 'seller'], true);
    }

    /**
     * Display a listing of the products in pagination.
     *
     * 
     */
    public function index(Request $request) {
        $user = $this->getAuthenticatedUser($request);

        $soldSubquery = DB::table('checkout_items as ci')
            ->join('checkouts as c', 'ci.checkout_id', '=', 'c.checkout_id')
            ->where('c.status', 'completed')
            ->whereColumn('ci.product_id', 'products.product_id')
            ->selectRaw('COALESCE(SUM(ci.quantity), 0)');

        $productsQuery = Product::select('products.*')
            ->selectSub($soldSubquery, 'sold');

        if (!$this->canViewAllProducts($user)) {
            $productsQuery->where('approval_status', 'approved');
        }

        $products = $productsQuery->get();
        $products->load(['category', 'brand', 'seller']);

        // Format the response to include category, brand and seller info plus approval fields
        $data = $products->map(function ($p) {
            return [
                'product_id' => $p->product_id,
                'product_name' => $p->product_name,
                'product_price' => $p->product_price,
                'product_description' => $p->product_description,
                'stock_quantity' => $p->stock_quantity,
                'sold' => $p->sold ?? 0,
                'image' => $p->image,
                'status' => $p->status,
                'category' => $p->category?->name,
                'brand' => $p->brand?->name,
                'seller' => $p->seller ? ['user_id' => $p->seller->user_id, 'username' => $p->seller->username] : null,
                'approval_status' => $p->approval_status ?? 'pending',
                'approval_reason' => $p->approval_reason ?? null,
                'approved_at' => $p->approved_at ?? null,
                'approved_by' => $p->approved_by ?? null,
                'created_at' => $p->created_at?->format('M d, Y'),
            ];
        });

        return response()->json(['data' => $data], 200);
    }
   
    /**
     * Product create
     */
    public function createProduct(Request $request){
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $request->validate([
                    'category_id' => 'required|integer|exists:categories,category_id',
                    'brand_id' => 'required|integer|exists:brands,brand_id',
                    'product_name' => 'required|string|max:255',
                    'product_price' => 'required|numeric|min:0',
                    'product_description' => 'nullable|string|max:1000',
                    'stock_quantity' => 'required|integer|min:0',
                    'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:102400'
                ]);
                $product = new Product();
                $product->seller_id = $user->user_id;
                $product->category_id = $request->category_id;
                $product->brand_id = $request->brand_id;
                $product->product_name = $request->product_name;
                $product->product_price = $request->product_price;
                $product->product_description = $request->product_description;
                $product->stock_quantity = $request->stock_quantity;
                if ($request->hasFile('image')) {
                    $image = $request->file('image');
                    $imageName = time() . '.' . $image->getClientOriginalExtension();
                    $destinationPath = public_path('FrontEnd/assets/img/product');
                    if (!File::exists($destinationPath)) {
                        File::makeDirectory($destinationPath, 0755, true);
                    }
                    if (!$image->move($destinationPath, $imageName)) {
                        return response()->json(['msg' => 'Failed to upload image.'], 500);
                    }
                    $product->image = $imageName;
                } else {
                    return response()->json(['msg' => 'Failed to upload image.', 'path' => $destinationPath], 400);
                }
                $product->save();
                return response()->json([
                    'msg' => 'New Product was successfully saved.',
                    'category' => $product

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
     * Product read by id
     */
    public function getProduct_id(Request $request, $id){
        $user = $this->getAuthenticatedUser($request);

        $productQuery = Product::with(['category', 'brand', 'seller'])
            ->where('product_id', $id);

        if (!$this->canViewAllProducts($user)) {
            $productQuery->where('approval_status', 'approved');
        }

        $product = $productQuery->first();
        if(!$product){
            return response()->json([
                'msg' => 'Product not found.'
            ], 404);
        }

        // include approval fields and related info
        $result = [
            'product_id' => $product->product_id,
            'product_name' => $product->product_name,
            'product_price' => $product->product_price,
            'product_description' => $product->product_description,
            'stock_quantity' => $product->stock_quantity,
            'image' => $product->image,
            'status' => $product->status,
            'category' => $product->category?->name,
            'brand' => $product->brand?->name,
            'seller' => $product->seller ? ['user_id' => $product->seller->user_id, 'username' => $product->seller->username] : null,
            'approval_status' => $product->approval_status ?? 'pending',
            'approval_reason' => $product->approval_reason ?? null,
            'approved_at' => $product->approved_at ?? null,
            'approved_by' => $product->approved_by ?? null,
            'created_at' => $product->created_at?->format('M d, Y'),
        ];

        return response()->json(['product' => $result], 200);
    }

    /**
     * Product delete
     */
    public function deleteProduct(Request $request, $id){
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $product = Product::find($id);
                if (!$product) {
                    return response()->json([
                        'msg' => 'Product not found.'
                    ], 404);
                }
                $product->delete();
                return response()->json([
                    'msg' => 'Product was successfully deleted.'
                ], 200);
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
     * Product update
     */
    public function updateProduct(Request $request, $id){

            \Log::info('Incoming updateProduct request', [
            'all' => $request->all(),
            'hasFile' => $request->hasFile('image'),
            'method' => $request->method(),
            '_method' => $request->input('_method'),
        ]);
        
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $product = Product::find($id);
                if (!$product) {
                    return response()->json(['msg' => 'Product not found.'], 404);
                }

                $request->validate([
                    'edit_category_id' => 'required|integer|exists:categories,category_id',
                    'edit_brand_id' => 'required|integer|exists:brands,brand_id',
                    'edit_product_name' => 'required|string|max:255',
                    'edit_product_price' => 'required|numeric|min:0',
                    'edit_product_description' => 'nullable|string|max:1000',
                    'edit_stock_quantity' => 'required|integer|min:0',
                    'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:102400'
                ]);

                $product->category_id = $request->edit_category_id;
                $product->brand_id = $request->edit_brand_id;
                $product->product_name = $request->edit_product_name;
                $product->product_price = $request->edit_product_price;
                $product->product_description = $request->edit_product_description;
                $product->stock_quantity = $request->edit_stock_quantity;

                if ($request->hasFile('image')) {
                    $image = $request->file('image');
                    $imageName = time() . '.' . $image->getClientOriginalExtension();
                    $destinationPath = public_path('FrontEnd/assets/img/product');
                    if (!File::exists($destinationPath)) {
                        File::makeDirectory($destinationPath, 0755, true);
                    }
                    if (!$image->move($destinationPath, $imageName)) {
                        return response()->json(['msg' => 'Failed to upload image.'], 500);
                    }
                    $product->image = $imageName;
                }

                $product->save();
            return response()->json([
                'msg' => 'Product was successfully updated.'
            ], 200);
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
     * Approve a product (admin action)
     */
    public function approveProduct(Request $request, $id)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return response()->json(['msg' => 'No Token Provided.'], 400);
        }

        $user = User::where('token', $token)->first();
        if (!$user || $user->role !== 'admin') {
            return response()->json(['msg' => 'Unauthorized.'], 403);
        }

        $product = Product::find($id);
        if (!$product) {
            return response()->json(['msg' => 'Product not found.'], 404);
        }

        $product->approval_status = 'approved';
        $product->approval_reason = null;
        $product->approved_at = now();
        $product->approved_by = $user->user_id;
        $product->save();

        return response()->json(['msg' => 'Product approved.'], 200);
    }

    /**
     * Reject a product with reason (admin action)
     */
    public function rejectProduct(Request $request, $id)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return response()->json(['msg' => 'No Token Provided.'], 400);
        }

        $user = User::where('token', $token)->first();
        if (!$user || $user->role !== 'admin') {
            return response()->json(['msg' => 'Unauthorized.'], 403);
        }

        $product = Product::find($id);
        if (!$product) {
            return response()->json(['msg' => 'Product not found.'], 404);
        }

        $data = $request->all();
        $reason = $data['reason'] ?? null;

        $product->approval_status = 'rejected';
        $product->approval_reason = $reason;
        $product->approved_at = now();
        $product->approved_by = $user->user_id;
        $product->save();

        return response()->json(['msg' => 'Product rejected.'], 200);
    }

}
