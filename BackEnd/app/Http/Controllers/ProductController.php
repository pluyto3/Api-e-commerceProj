<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\File;
use Illuminate\Http\FileException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Services\PushNotificationService;

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
        return $user && $user->role === 'admin';
    }

    private function isSeller(?User $user): bool
    {
        return $user && $user->role === 'seller';
    }

    private function hasColumn(string $table, string $column): bool
    {
        static $cache = [];

        $key = "{$table}.{$column}";
        if (!array_key_exists($key, $cache)) {
            $cache[$key] = Schema::hasColumn($table, $column);
        }

        return $cache[$key];
    }

    private function productStockColumn(): ?string
    {
        if ($this->hasColumn('products', 'stock_quantity')) {
            return 'stock_quantity';
        }

        if ($this->hasColumn('products', 'amount')) {
            return 'amount';
        }

        return null;
    }

    private function applyPublicVisibility($query)
    {
        if ($this->hasColumn('products', 'approval_status')) {
            $query->where('approval_status', 'approved');
        }

        if ($this->hasColumn('products', 'status')) {
            $query->where('products.status', 'active');
        }

        $stockColumn = $this->productStockColumn();
        if ($stockColumn) {
            $query->where("products.{$stockColumn}", '>', 0);
        }

        if ($this->hasColumn('categories', 'status')) {
            $query->whereHas('category', fn ($categoryQuery) => $categoryQuery->where('status', 'approved'));
        }

        if ($this->hasColumn('brands', 'status')) {
            $query->whereHas('brand', fn ($brandQuery) => $brandQuery->where('status', 'approved'));
        }

        return $query;
    }

    private function productStatusFromStock(int $stock, ?string $requestedStatus = null): string
    {
        if ($stock <= 0) {
            return 'out_of_stock';
        }

        if (in_array($requestedStatus, ['active', 'inactive'], true)) {
            return $requestedStatus;
        }

        return 'active';
    }

    private function authorizeProductOwner(User $user, Product $product): bool
    {
        return $user->role === 'admin'
            || ($user->role === 'seller' && (int) $product->seller_id === (int) $user->user_id);
    }

    private function sellerOwnsCatalogRecord(string $table, string $primaryKey, int $id, User $user): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return DB::table($table)
            ->where($primaryKey, $id)
            ->where('seller_id', $user->user_id)
            ->when($this->hasColumn($table, 'status'), fn ($query) => $query->where('status', 'approved'))
            ->exists();
    }

    private function formatProduct(Product $p): array
    {
        $stockQuantity = (int) ($p->stock_quantity ?? $p->amount ?? 0);

        return [
            'product_id' => $p->product_id,
            'seller_id' => $p->seller_id,
            'category_id' => $p->category_id,
            'brand_id' => $p->brand_id,
            'product_name' => $p->product_name,
            'product_price' => $p->product_price,
            'product_description' => $p->product_description,
            'stock_quantity' => $stockQuantity,
            'low_stock' => $stockQuantity > 0 && $stockQuantity <= 5,
            'sold' => $p->sold ?? 0,
            'image' => $p->image,
            'status' => $p->status ?? ($stockQuantity > 0 ? 'active' : 'out_of_stock'),
            'category' => $p->category?->name,
            'brand' => $p->brand?->name,
            'seller' => $p->seller ? ['user_id' => $p->seller->user_id, 'username' => $p->seller->username] : null,
            'approval_status' => $p->approval_status ?? 'approved',
            'approval_reason' => $p->approval_reason ?? null,
            'approved_at' => $p->approved_at ?? null,
            'approved_by' => $p->approved_by ?? null,
            'created_at' => $p->created_at?->format('M d, Y'),
            'updated_at' => $p->updated_at?->format('M d, Y'),
        ];
    }

    /**
     * Display a listing of the products in pagination.
     *
     * 
     */
    public function index(Request $request) {
        $user = $this->getAuthenticatedUser($request);
        $publicScope = $request->input('scope') === 'public';

        $soldSubquery = DB::table('checkout_items as ci')
            ->join('checkouts as c', 'ci.checkout_id', '=', 'c.checkout_id')
            ->where(function ($query) {
                if ($this->hasColumn('checkouts', 'shipping_status')) {
                    $query->where('c.shipping_status', 'delivered')
                        ->orWhere('c.status', 'completed')
                        ->orWhere('c.status', 'delivered');

                    return;
                }

                $query->where('c.status', 'completed')
                    ->orWhere('c.status', 'delivered');
            })
            ->whereColumn('ci.product_id', 'products.product_id')
            ->selectRaw('COALESCE(SUM(ci.quantity), 0)');

        $productsQuery = Product::select('products.*')
            ->with(['category', 'brand', 'seller'])
            ->selectSub($soldSubquery, 'sold');

        if (!$publicScope && $this->isSeller($user)) {
            $productsQuery->where('seller_id', $user->user_id);
        } elseif ($publicScope || !$this->canViewAllProducts($user)) {
            $this->applyPublicVisibility($productsQuery);
        }

        if ($request->filled('search') || $request->filled('q')) {
            $search = trim((string) ($request->input('search') ?: $request->input('q')));
            $productsQuery->where(function ($query) use ($search) {
                $query->where('product_name', 'like', "%{$search}%")
                    ->orWhere('product_description', 'like', "%{$search}%")
                    ->orWhereHas('category', fn ($catQuery) => $catQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('brand', fn ($brandQuery) => $brandQuery->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('category_id')) {
            $productsQuery->where('category_id', (int) $request->input('category_id'));
        }

        if ($request->filled('brand_id')) {
            $productsQuery->where('brand_id', (int) $request->input('brand_id'));
        }

        if ($request->filled('min_price')) {
            $productsQuery->where('product_price', '>=', (float) $request->input('min_price'));
        }

        if ($request->filled('max_price')) {
            $productsQuery->where('product_price', '<=', (float) $request->input('max_price'));
        }

        match ($request->input('sort', 'newest')) {
            'price_asc' => $productsQuery->orderBy('product_price', 'asc'),
            'price_desc' => $productsQuery->orderBy('product_price', 'desc'),
            'name_asc' => $productsQuery->orderBy('product_name', 'asc'),
            'name_desc' => $productsQuery->orderBy('product_name', 'desc'),
            'oldest' => $productsQuery->orderBy('created_at', 'asc'),
            default => $productsQuery->orderBy('created_at', 'desc'),
        };

        if ($request->filled('per_page')) {
            $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
            $paginated = $productsQuery->paginate($perPage);

            return response()->json([
                'data' => $paginated->getCollection()->map(fn ($p) => $this->formatProduct($p))->values(),
                'meta' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
            ], 200);
        }

        $products = $productsQuery->get();
        $data = $products->map(fn ($p) => $this->formatProduct($p));

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
                if (!in_array($user->role, ['admin', 'seller'], true)) {
                    return response()->json(['msg' => 'Unauthorized.'], 403);
                }

                $request->validate([
                    'category_id' => 'required|integer|exists:categories,category_id',
                    'brand_id' => 'required|integer|exists:brands,brand_id',
                    'product_name' => 'required|string|max:255',
                    'product_price' => 'required|numeric|min:0',
                    'product_description' => 'nullable|string|max:1000',
                    'stock_quantity' => 'required|integer|min:0',
                    'status' => 'nullable|string|in:active,inactive,out_of_stock',
                    'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:102400'
                ]);

                if (
                    !$this->sellerOwnsCatalogRecord('categories', 'category_id', (int) $request->category_id, $user) ||
                    !$this->sellerOwnsCatalogRecord('brands', 'brand_id', (int) $request->brand_id, $user)
                ) {
                    return response()->json([
                        'msg' => 'You can only use approved categories and brands that belong to your seller account.',
                    ], 403);
                }

                $product = new Product();
                $product->seller_id = $user->user_id;
                $product->category_id = $request->category_id;
                $product->brand_id = $request->brand_id;
                $product->product_name = $request->product_name;
                $product->product_price = $request->product_price;
                $product->product_description = $request->product_description;
                $product->stock_quantity = $request->stock_quantity;
                $product->status = $this->productStatusFromStock(
                    (int) $request->stock_quantity,
                    $request->input('status', 'active')
                );
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

                if ($user->role === 'seller') {
                    try {
                        $admins = User::where('role', 'admin')->get();

                        foreach ($admins as $admin) {
                            app(PushNotificationService::class)->sendToUser(
                                $admin->user_id,
                                'New Product Request',
                                'A seller submitted a new product for approval.',
                                'product.html',
                                'product_request',
                                $product->product_id
                            );
                        }
                    } catch (\Exception $notificationError) {
                        \Log::error('Product request FCM notification failed: ' . $notificationError->getMessage());
                    }
                }
                
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
        $publicScope = $request->input('scope') === 'public';

        $productQuery = Product::with(['category', 'brand', 'seller'])
            ->where('product_id', $id);

        if (!$publicScope && $this->isSeller($user)) {
            $productQuery->where('seller_id', $user->user_id);
        } elseif ($publicScope || !$this->canViewAllProducts($user)) {
            $this->applyPublicVisibility($productQuery);
        }

        $product = $productQuery->first();
        if(!$product){
            return response()->json([
                'msg' => 'Product not found.'
            ], 404);
        }

        return response()->json(['product' => $this->formatProduct($product)], 200);
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
                if (!$this->authorizeProductOwner($user, $product)) {
                    return response()->json([
                        'msg' => 'Unauthorized. Sellers can only delete their own products.'
                    ], 403);
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
                if (!$this->authorizeProductOwner($user, $product)) {
                    return response()->json([
                        'msg' => 'Unauthorized. Sellers can only update their own products.'
                    ], 403);
                }

                $request->validate([
                    'edit_category_id' => 'required|integer|exists:categories,category_id',
                    'edit_brand_id' => 'required|integer|exists:brands,brand_id',
                    'edit_product_name' => 'required|string|max:255',
                    'edit_product_price' => 'required|numeric|min:0',
                    'edit_product_description' => 'nullable|string|max:1000',
                    'edit_stock_quantity' => 'required|integer|min:0',
                    'edit_status' => 'nullable|string|in:active,inactive,out_of_stock',
                    'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:102400'
                ]);

                if (
                    !$this->sellerOwnsCatalogRecord('categories', 'category_id', (int) $request->edit_category_id, $user) ||
                    !$this->sellerOwnsCatalogRecord('brands', 'brand_id', (int) $request->edit_brand_id, $user)
                ) {
                    return response()->json([
                        'msg' => 'You can only use approved categories and brands that belong to your seller account.',
                    ], 403);
                }

                $product->category_id = $request->edit_category_id;
                $product->brand_id = $request->edit_brand_id;
                $product->product_name = $request->edit_product_name;
                $product->product_price = $request->edit_product_price;
                $product->product_description = $request->edit_product_description;
                $product->stock_quantity = $request->edit_stock_quantity;
                $product->status = $this->productStatusFromStock(
                    (int) $request->edit_stock_quantity,
                    $request->input('edit_status', $product->status)
                );

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

        $oldApprovalStatus = $product->approval_status;

        $product->approval_status = 'approved';
        $product->approval_reason = null;
        $product->approved_at = now();
        $product->approved_by = $user->user_id;
        $product->status = $this->productStatusFromStock((int) $product->stock_quantity, $product->status);
        $product->save();

        if ($product->seller_id && $oldApprovalStatus !== 'approved') {
            try {
                app(PushNotificationService::class)->sendToUser(
                    $product->seller_id,
                    'Product Approved',
                    'Your product "' . $product->product_name . '" has been approved.',
                    'product.html',
                    'product_approved',
                    $product->product_id
                );
            } catch (\Exception $notificationError) {
                \Log::error('Product approval FCM notification failed: ' . $notificationError->getMessage());
            }
        }
        return response()->json(['msg' => 'Product approved.'], 200);
    }

    /**
     * Reject a product with reason (admin action)
     */
    public function rejectProduct(Request $request, $id) {
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

        $oldApprovalStatus = $product->approval_status;

        $data = $request->all();
        $reason = $data['reason'] ?? null;

        $product->approval_status = 'rejected';
        $product->approval_reason = $reason;
        $product->approved_at = now();
        $product->approved_by = $user->user_id;
        $product->save();

        if ($product->seller_id && $oldApprovalStatus !== 'rejected') {
            try {
                app(PushNotificationService::class)->sendToUser(
                    $product->seller_id,
                    'Product Rejected',
                    'Your product "' . $product->product_name . '" has been rejected.',
                    'product.html',
                    'product_rejected',
                    $product->product_id
                );
            } catch (\Exception $notificationError) {
                \Log::error('Product rejection FCM notification failed: ' . $notificationError->getMessage());
            }
        }
        return response()->json(['msg' => 'Product rejected.'], 200);
    }

}
