<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Http\FileException;
use Illuminate\Support\Facades\Storage;
use Illuminate\Auth\AuthenticationException;


class CategoryController extends Controller
{
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

    private function canManageCategory(User $user, Category $category): bool
    {
        return $user->role === 'admin'
            || ($user->role === 'seller' && (int) $category->seller_id === (int) $user->user_id);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request){
        $user = $this->getAuthenticatedUser($request);
        $publicScope = $request->input('scope') === 'public';

        $categoriesQuery = Category::with(['seller', 'approver']);

        if ($publicScope || !$user || $user->role === 'user') {
            $categoriesQuery->where('status', 'approved');
        } elseif ($user->role === 'seller') {
            $categoriesQuery->where('seller_id', $user->user_id);
        }

        $categories = $categoriesQuery->get();
        $data = $categories->map(fn($category) => $this->formatCategory($category));

        return response()->json(['data' => $data], 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function createCategory(Request $request){
        $user = $this->getAuthenticatedUser($request);
        if(!$user){
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 400);
        }

        if (!in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json(['msg' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'name' => 'required|string|unique:categories,name',
            'description' => 'nullable|string',
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:102400'
        ]);

        $category = new Category();
        $category->name = $request->name;
        $category->description = $request->description;
        $category->seller_id = $user->user_id;
        $category->status = $user->role === 'admin' ? 'approved' : 'pending';
        $category->approval_reason = null;
        $category->approved_by = $user->role === 'admin' ? $user->user_id : null;

        $destinationPath = public_path('FrontEnd/assets/img/category');

        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imageName = time() . '.' . $image->getClientOriginalExtension();
            if (!File::exists($destinationPath)) {
                File::makeDirectory($destinationPath, 0755, true);  
            }
            if (!$image->move($destinationPath, $imageName)) {
                return response()->json(['msg' => 'Failed to upload image.'], 500);
            }
            $category->image = $imageName;
        } else {
            return response()->json(['msg' => 'Failed to upload image.', 'path' => $destinationPath], 400);
        }

        $category->save();
        $category->load(['seller', 'approver']);

        return response()->json([
            'msg' => 'New Category was successfully saved.',
            'category' => $this->formatCategory($category),
        ], 201);
    }

     /**
     * Display the specified resource.
     */
    public function getCategory_id(Request $request, $id) {
        $category = Category::with(['seller', 'approver'])->find($id);
        if(!$category){
            return response()->json(['message' => 'Category not found'], 404);
        }

        $user = $this->getAuthenticatedUser($request);
        if (!$user || $user->role === 'user') {
            if ($category->status !== 'approved') {
                return response()->json(['message' => 'Category not found'], 404);
            }
        } elseif ($user->role === 'seller' && (int) $category->seller_id !== (int) $user->user_id) {
            return response()->json(['message' => 'Category not found'], 404);
        }

        return response()->json($this->formatCategory($category), 200);
    }   

    /**
     * Update the specified resource in storage.
     */
    public function updateCategory(Request $request, $id) {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 400);
        }

        $category = Category::find($id);
        
        if (!$category) {
            return response()->json(['msg' => 'Category not found.'], 404);
        }

        if (!$this->canManageCategory($user, $category)) {
            return response()->json(['msg' => 'Unauthorized. Sellers can only update their own categories.'], 403);
        }

        $request->validate([
            'editName' => 'required|string|unique:categories,name,' . $id . ',category_id',
            'editDescription' => 'nullable|string',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:102400'
        ]);

        $category->name = $request->editName;
        if ($request->has('editDescription')) {
            $category->description = $request->editDescription;
        }

        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imageName = time() . '.' . $image->getClientOriginalExtension();
            $destinationPath = public_path('FrontEnd/assets/img/category');
            if (!File::exists($destinationPath)) {
                File::makeDirectory($destinationPath, 0755, true);  
            }
            if (!$image->move($destinationPath, $imageName)) {
                return response()->json(['msg' => 'Failed to upload image.'], 500);
            }
            // Delete the old image if it exists
            if ($category->image) {
                $oldImagePath = public_path('FrontEnd/assets/img/category/' . $category->image);
                if (File::exists($oldImagePath)) {
                    File::delete($oldImagePath);
                }
            }

            $category->image = $imageName;
        }

        $category->save();
        $category->load(['seller', 'approver']);

        return response()->json([
            'msg' => 'Category updated successfully.',
            'category' => $this->formatCategory($category),
            'status' => 200
        ]);
    }

    /**
     * Approve category (admin action).
     */
    public function approveCategory(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['msg' => 'No Token Provided or Invalid Token.'], 400);
        }

        if ($user->role !== 'admin') {
            return response()->json(['msg' => 'Unauthorized.'], 403);
        }

        $category = Category::find($id);
        if (!$category) {
            return response()->json(['msg' => 'Category not found.'], 404);
        }

        $category->status = 'approved';
        $category->approval_reason = null;
        $category->approved_by = $user->user_id;
        $category->save();

        return response()->json(['msg' => 'Category approved.'], 200);
    }

    /**
     * Reject category (admin action).
     */
    public function rejectCategory(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['msg' => 'No Token Provided or Invalid Token.'], 400);
        }

        if ($user->role !== 'admin') {
            return response()->json(['msg' => 'Unauthorized.'], 403);
        }

        $category = Category::find($id);
        if (!$category) {
            return response()->json(['msg' => 'Category not found.'], 404);
        }

        $data = $request->all();
        $reason = $data['reason'] ?? null;

        $category->status = 'rejected';
        $category->approval_reason = $reason;
        $category->approved_by = $user->user_id;
        $category->save();

        return response()->json(['msg' => 'Category rejected.'], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function deleteCategory(Request $request, $id) {
         $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $category = Category::find($id);
                if (!$category) {
                    return response()->json([
                        'msg' => 'Category not found.'
                    ], 404);
                }
                if (!$this->canManageCategory($user, $category)) {
                    return response()->json([
                        'msg' => 'Unauthorized. Sellers can only delete their own categories.'
                    ], 403);
                }
                $category->delete();
                return response()->json([
                    'msg' => 'Category was successfully deleted.'
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
