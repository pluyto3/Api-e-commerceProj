<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\File;
use Illuminate\Http\FileException;

class ProductController extends Controller
{

    /**
     * Display a listing of the products in pagination.
     *
     * 
     */
    public function index(Request $request) {
        $token = request()->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){ 

                // Fetch all products along with their related category and brand
                $products = Product::with(['category', 'brand'])->get();

                // Format the response to include category and brand names
                $data = $products->map(function ($p) {
                    return [
                        'product_id' => $p->product_id,
                        'product_name' => $p->product_name,
                        'product_price' => $p->product_price,
                        'product_description' => $p->product_description,
                        'stock_quantity' => $p->stock_quantity,
                        'image' => $p->image,
                        'status' => $p->status,
                        'category_name' => $p->category?->name,
                        'brand_name' => $p->brand?->name,
                    ];
                });

                return response()->json(['data' => $data]);
            } else {
                return response()->json([
                    'msg' => 'No products.'
                ], 400);
            }
        } else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
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
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $product = Product::find($id);
                if($product){
                    return response()->json($product, 200);
                }
                else {
                    return response()->json([
                        'msg' => 'Product not found.'
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

}
