<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use App\Services\PushNotificationService;


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

            $categoriesQuery
                ->where('status', 'approved')
                ->where('is_active', true);

        } elseif ($user->role === 'seller') {

            // Seller still sees their active and deactivated categories.
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
        $category->is_active = true;
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

        if ($user->role === 'seller') {
            try {
                $admins = User::where('role', 'admin')->get();

                foreach ($admins as $admin) {
                    app(PushNotificationService::class)->sendToUser(
                        $admin->user_id,
                        'New Category Request',
                        'A seller submitted a new category for approval.',
                        'category.html',
                        'category_request',
                        $category->category_id
                    );
                }
            } catch (\Exception $notificationError) {
                \Log::error('Category request FCM notification failed: ' . $notificationError->getMessage());
            }
        }

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
            if (
                $category->status !== 'approved' ||
                !$category->is_active
            ) {
                return response()->json([
                    'message' => 'Category not found'
                ], 404);
            }
        } elseif ($user->role === 'seller' && (int) $category->seller_id !== (int) $user->user_id) {
            return response()->json(['message' => 'Category not found'], 404);
        }

        return response()->json($this->formatCategory($category), 200);
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
            ], 400);
        }

        $category = Category::find($id);

        if (!$category) {
            return response()->json([
                'msg' => 'Category not found.'
            ], 404);
        }

        if (!$this->canManageCategory($user, $category)) {
            return response()->json([
                'msg' => 'Unauthorized. Sellers can only update their own categories.'
            ], 403);
        }

        // Remember the status BEFORE making changes.
        $oldStatus = strtolower($category->status ?? 'pending');

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
            $category->description =
                $request->editDescription;
        }

        if ($request->hasFile('image')) {

            $image = $request->file('image');

            $imageName =
                time() . '.' .
                $image->getClientOriginalExtension();

            $destinationPath =
                public_path(
                    'FrontEnd/assets/img/category'
                );

            if (!File::exists($destinationPath)) {
                File::makeDirectory(
                    $destinationPath,
                    0755,
                    true
                );
            }

            if (
                !$image->move(
                    $destinationPath,
                    $imageName
                )
            ) {
                return response()->json([
                    'msg' => 'Failed to upload image.'
                ], 500);
            }

            // Delete old image if it exists.
            if ($category->image) {

                $oldImagePath =
                    public_path(
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
        * Any seller edit requires admin review again.
        *
        * pending  -> pending
        * approved -> pending
        * rejected -> pending
        */
        if ($user->role === 'seller') {

            $category->status = 'pending';

            $category->approval_reason = null;

            $category->approved_by = null;
        }

        $category->save();

        /*
        * Notify admins when a seller
        * updates/resubmits a category.
        */
        if ($user->role === 'seller') {

            try {

                $admins =
                    User::where(
                        'role',
                        'admin'
                    )->get();

                if ($oldStatus === 'approved') {

                    $notificationTitle =
                        'Category Edit Request';

                    $notificationMessage =
                        'Seller "' .
                        $user->username .
                        '" submitted changes to approved category "' .
                        $category->name .
                        '" for review.';

                    $notificationType =
                        'category_edit_request';

                } elseif ($oldStatus === 'rejected') {

                    $notificationTitle =
                        'Category Resubmitted';

                    $notificationMessage =
                        'Seller "' .
                        $user->username .
                        '" resubmitted category "' .
                        $category->name .
                        '" for approval.';

                    $notificationType =
                        'category_resubmitted';

                } else {

                    $notificationTitle =
                        'Category Updated';

                    $notificationMessage =
                        'Seller "' .
                        $user->username .
                        '" updated pending category "' .
                        $category->name .
                        '".';

                    $notificationType =
                        'category_updated';
                }

                foreach ($admins as $admin) {

                    app(
                        PushNotificationService::class
                    )->sendToUser(
                        $admin->user_id,
                        $notificationTitle,
                        $notificationMessage,
                        'category.html',
                        $notificationType,
                        $category->category_id
                    );
                }

            } catch (\Exception $notificationError) {

                \Log::error(
                    'Category update FCM notification failed: ' .
                    $notificationError->getMessage()
                );
            }
        }

        $category->load([
            'seller',
            'approver'
        ]);

        /*
        * Give a more accurate response depending
        * on what the seller actually did.
        */
        if ($user->role === 'seller') {

            if ($oldStatus === 'approved') {

                $message =
                    'Category changes submitted successfully and are now pending admin approval.';

            } elseif ($oldStatus === 'rejected') {

                $message =
                    'Category resubmitted successfully and is now pending admin approval.';

            } else {

                $message =
                    'Category updated successfully and remains pending admin approval.';
            }

        } else {

            $message =
                'Category updated successfully.';
        }

        return response()->json([
            'msg' => $message,
            'category' =>
                $this->formatCategory($category),
            'status' => 200
        ], 200);
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

        $oldStatus = $category->status;

        $category->status = 'approved';
        $category->approval_reason = null;
        $category->approved_by = $user->user_id;
        $category->save();

        if ($category->seller_id && $oldStatus !== 'approved') {
            try {
                app(PushNotificationService::class)->sendToUser(
                    $category->seller_id,
                    'Category Approved',
                    'Your category "' . $category->name . '" has been approved.',
                    'category.html',
                    'category_approved',
                    $category->category_id
                );
            } catch (\Exception $notificationError) {
                \Log::error('Category approval FCM notification failed: ' . $notificationError->getMessage());
            }
        }
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

        $oldStatus = $category->status;

        $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $reason = trim($request->reason);

        $category->status = 'rejected';
        $category->approval_reason = $reason;
        $category->approved_by = $user->user_id;
        $category->save();

        if ($category->seller_id && $oldStatus !== 'rejected') {
            try {
                app(PushNotificationService::class)->sendToUser(
                    $category->seller_id,
                    'Category Rejected',
                    'Your category "' . $category->name . '" was rejected.',
                    'category.html',
                    'category_rejected',
                    $category->category_id
                );
            } catch (\Exception $notificationError) {
                \Log::error('Category rejection FCM notification failed: ' . $notificationError->getMessage());
            }
        }
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
                        'msg' =>
                            'Unauthorized. Sellers can only delete their own categories.'
                    ], 403);
                }

                // Sellers cannot permanently delete approved categories.
                if (
                    $user->role === 'seller' &&
                    strtolower($category->status ?? '') === 'approved'
                ) {
                    return response()->json([
                        'msg' =>
                            'Approved categories cannot be permanently deleted. Deactivate the category instead.'
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

        if ($user->role !== 'seller') {
            return response()->json([
                'msg' => 'Only sellers can deactivate categories.'
            ], 403);
        }

        $category = Category::find($id);

        if (!$category) {
            return response()->json([
                'msg' => 'Category not found.'
            ], 404);
        }

        if ((int) $category->seller_id !== (int) $user->user_id) {
            return response()->json([
                'msg' => 'You can only deactivate your own categories.'
            ], 403);
        }

        if (strtolower($category->status ?? '') !== 'approved') {
            return response()->json([
                'msg' => 'Only approved categories can be deactivated.'
            ], 422);
        }

        if (!$category->is_active) {
            return response()->json([
                'msg' => 'Category is already deactivated.'
            ], 200);
        }

        $category->is_active = false;
        $category->save();

        $category->load(['seller', 'approver']);

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

        if ($user->role !== 'seller') {
            return response()->json([
                'msg' => 'Only sellers can reactivate categories.'
            ], 403);
        }

        $category = Category::find($id);

        if (!$category) {
            return response()->json([
                'msg' => 'Category not found.'
            ], 404);
        }

        if ((int) $category->seller_id !== (int) $user->user_id) {
            return response()->json([
                'msg' => 'You can only reactivate your own categories.'
            ], 403);
        }

        // Prevent rejected/pending categories from bypassing approval.
        if (strtolower($category->status ?? '') !== 'approved') {
            return response()->json([
                'msg' => 'Only approved categories can be reactivated.'
            ], 422);
        }

        if ($category->is_active) {
            return response()->json([
                'msg' => 'Category is already active.'
            ], 200);
        }

        $category->is_active = true;
        $category->save();

        $category->load(['seller', 'approver']);

        return response()->json([
            'msg' => 'Category reactivated successfully.',
            'category' => $this->formatCategory($category),
        ], 200);
    }
}
