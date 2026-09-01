<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\DB;

class CategoryController extends Controller {
    private function getAuthenticatedUser(Request $request)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return null;
        }

        return User::where('token', $token)->first();
    }

    private function formatCategory(Category $category): array
    {
        return [
            'category_id' => $category->category_id,
            'name' => $category->name,
            'image' => $category->image,
            'description' => $category->description,
            'seller_id' => $category->seller_id,
            'seller' => $category->seller
                ? [
                    'user_id' => $category->seller->user_id,
                    'username' => $category->seller->username,
                ]
                : null,
            'status' => $category->status ?? 'pending',
            'is_active' => (bool) $category->is_active,
            'approval_reason' => $category->approval_reason,
            'approved_by' => $category->approved_by,
            'approved_by_user' => $category->approver
                ? [
                    'user_id' => $category->approver->user_id,
                    'username' => $category->approver->username,
                ]
                : null,
            'created_at' => $category->created_at ? $category->created_at->format('M d, Y') : null,
            'updated_at' => $category->updated_at ? $category->updated_at->format('M d, Y') : null,
        ];
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        $publicScope = $request->input('scope') === 'public';

        $categoriesQuery = Category::with(['seller', 'approver']);

        $isActiveAdmin =
        $user &&
        $user->role === 'admin' &&
        $user->is_active;

        if (
            $publicScope ||
            !$isActiveAdmin
        ) {
            $categoriesQuery
                ->where('status', 'approved')
                ->where('is_active', true);
        }

        $categories = $categoriesQuery->get();

        $data = $categories->map(
            fn ($category) => $this->formatCategory($category)
        );

        return response()->json([
            'data' => $data
        ], 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function createCategory(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        if ($user->role !== 'admin') {
            return response()->json([
                'msg' => 'Unauthorized. Administrator access required.'
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|unique:categories,name',
            'description' => 'nullable|string',
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:102400'
        ]);

        $category = new Category();

        $category->name = $request->name;
        $category->description = $request->description;

        // Categories are global and are not owned by sellers.
        $category->seller_id = null;

        // Admin-created categories are immediately approved.
        $category->status = 'approved';
        $category->is_active = true;
        $category->approval_reason = null;
        $category->approved_by = $user->user_id;

        $destinationPath = public_path(
            'FrontEnd/assets/img/category'
        );

        if (!File::exists($destinationPath)) {
            File::makeDirectory(
                $destinationPath,
                0755,
                true
            );
        }

        $image = $request->file('image');

        $imageName =
            time() . '.' .
            $image->getClientOriginalExtension();

        if (!$image->move(
            $destinationPath,
            $imageName
        )) {
            return response()->json([
                'msg' => 'Failed to upload image.'
            ], 500);
        }

        $category->image = $imageName;

        $category->save();

        $category->load([
            'seller',
            'approver'
        ]);

        return response()->json([
            'msg' => 'Category created successfully.',
            'category' => $this->formatCategory($category),
        ], 201);
    }

     /**
     * Display the specified resource.
     */
    public function getCategory_id(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);

        $category = Category::with([
            'seller',
            'approver'
        ])->find($id);

        if (!$category) {
            return response()->json([
                'message' => 'Category not found'
            ], 404);
        }
        
        $isActiveAdmin =
            $user &&
            $user->role === 'admin' &&
            $user->is_active;

        if (!$isActiveAdmin) {
            if (
                strtolower($category->status ?? '') !== 'approved' ||
                !$category->is_active
            ) {
                return response()->json([
                    'message' => 'Category not found'
                ], 404);
            }
        }

        return response()->json(
            $this->formatCategory($category),
            200
        );
    }  

    /**
     * Update the specified resource in storage.
     */
    public function updateCategory(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        if ($user->role !== 'admin') {
            return response()->json([
                'msg' => 'Unauthorized. Administrator access required.'
            ], 403);
        }

        $category = Category::find($id);

        if (!$category) {
            return response()->json([
                'msg' => 'Category not found.'
            ], 404);
        }

        $request->validate([
            'editName' =>
                'required|string|unique:categories,name,' .
                $id .
                ',category_id',

            'editDescription' => 'nullable|string',

            'image' =>
                'nullable|image|mimes:jpeg,png,jpg,gif|max:102400'
        ]);

        $category->name = $request->editName;

        if ($request->has('editDescription')) {
            $category->description = $request->editDescription;
        }

        if ($request->hasFile('image')) {

            $destinationPath = public_path(
                'FrontEnd/assets/img/category'
            );

            if (!File::exists($destinationPath)) {
                File::makeDirectory(
                    $destinationPath,
                    0755,
                    true
                );
            }

            $image = $request->file('image');

            $imageName =
                time() . '.' .
                $image->getClientOriginalExtension();

            if (!$image->move(
                $destinationPath,
                $imageName
            )) {
                return response()->json([
                    'msg' => 'Failed to upload image.'
                ], 500);
            }

            // Delete the previous image after the new image
            // has been successfully uploaded.
            if ($category->image) {

                $oldImagePath = public_path(
                    'FrontEnd/assets/img/category/' .
                    $category->image
                );

                if (File::exists($oldImagePath)) {
                    File::delete($oldImagePath);
                }
            }

            $category->image = $imageName;
        }

        /*
        * Categories are global and Admin-managed.
        * An Admin edit does not require another approval process.
        */
        $category->seller_id = null;
        $category->status = 'approved';
        $category->approval_reason = null;
        $category->approved_by = $user->user_id;

        $category->save();

        $category->load([
            'seller',
            'approver'
        ]);

        return response()->json([
            'msg' => 'Category updated successfully.',
            'category' => $this->formatCategory($category),
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function deleteCategory(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        if ($user->role !== 'admin') {
            return response()->json([
                'msg' => 'Unauthorized. Administrator access required.'
            ], 403);
        }

        $category = Category::find($id);

        if (!$category) {
            return response()->json([
                'msg' => 'Category not found.'
            ], 404);
        }

        /*
        * Never permanently delete a global category
        * that is already referenced by a product.
        */
        $isUsedByProducts = DB::table('products')
            ->where('category_id', $category->category_id)
            ->exists();

        if ($isUsedByProducts) {
            return response()->json([
                'msg' => 'This category is being used by existing products and cannot be permanently deleted. Deactivate the category instead.'
            ], 409);
        }

        /*
        * Delete the category image only after we know
        * the category itself can safely be deleted.
        */
        if ($category->image) {
            $imagePath = public_path(
                'FrontEnd/assets/img/category/' .
                $category->image
            );

            if (File::exists($imagePath)) {
                File::delete($imagePath);
            }
        }

        $category->delete();

        return response()->json([
            'msg' => 'Category was successfully deleted.'
        ], 200);
    }

    /**
     * Deactivate approved category.
     * 
     */
    public function deactivateCategory(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        if ($user->role !== 'admin') {
            return response()->json([
                'msg' => 'Unauthorized. Administrator access required.'
            ], 403);
        }

        $category = Category::find($id);

        if (!$category) {
            return response()->json([
                'msg' => 'Category not found.'
            ], 404);
        }

        if (!$category->is_active) {
            return response()->json([
                'msg' => 'Category is already deactivated.'
            ], 200);
        }

        $category->is_active = false;
        $category->save();

        $category->load([
            'seller',
            'approver'
        ]);

        return response()->json([
            'msg' => 'Category deactivated successfully.',
            'category' => $this->formatCategory($category),
        ], 200);
    }


    /**
     * Reactivate approved category.
     */
    public function reactivateCategory(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        if ($user->role !== 'admin') {
            return response()->json([
                'msg' => 'Unauthorized. Administrator access required.'
            ], 403);
        }

        $category = Category::find($id);

        if (!$category) {
            return response()->json([
                'msg' => 'Category not found.'
            ], 404);
        }

        if ($category->is_active) {
            return response()->json([
                'msg' => 'Category is already active.'
            ], 200);
        }

        $category->is_active = true;
        $category->save();

        $category->load([
            'seller',
            'approver'
        ]);

        return response()->json([
            'msg' => 'Category reactivated successfully.',
            'category' => $this->formatCategory($category),
        ], 200);
    }
}
