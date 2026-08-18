<?php

namespace App\Http\Controllers;

use App\Models\Brands;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use App\Services\PushNotificationService;

class BrandsController extends Controller
{
    private function getAuthenticatedUser(Request $request)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return null;
        }

        return User::where('token', $token)->first();
    }

    private function canViewAllBrands(?User $user): bool
    {
        return $user && $user->role === 'admin';
    }

    private function canManageBrand(User $user, Brands $brand): bool
    {
        return $user->role === 'admin'
            || ($user->role === 'seller' && (int) $brand->seller_id === (int) $user->user_id);
    }

    private function formatBrand(Brands $brand): array
    {
        return [
            'brand_id' => $brand->brand_id,
            'name' => $brand->name,
            'image' => $brand->image,
            'description' => $brand->description,
            'seller_id' => $brand->seller_id,
            'seller' => $brand->seller
                ? [
                    'user_id' => $brand->seller->user_id,
                    'username' => $brand->seller->username,
                ]
                : null,
            'status' => $brand->status ?? 'pending',
            'is_active' => (bool) $brand->is_active,
            'approval_reason' => $brand->approval_reason,
            'approved_by' => $brand->approved_by,
            'approved_by_user' => $brand->approver
                ? [
                    'user_id' => $brand->approver->user_id,
                    'username' => $brand->approver->username,
                ]
                : null,
            'created_at' => $brand->created_at ? $brand->created_at->format('M d, Y') : null,
            'updated_at' => $brand->updated_at ? $brand->updated_at->format('M d, Y') : null,
        ];
    }

    /**
     * Display all brands.
     */
    public function index(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        $publicScope = $request->input('scope') === 'public';

        $brandsQuery = Brands::with(['seller', 'approver']);
        if (!$publicScope && $user && $user->role === 'seller') {

            // Seller can see all of their own brands,
            // including deactivated brands.
            $brandsQuery->where('seller_id', $user->user_id);

        } elseif ($publicScope || !$this->canViewAllBrands($user)) {
            
            // Customers/public only see approved AND active brands.
            $brandsQuery
                ->where('status', 'approved')
                ->where('is_active', true);
        }

        $brands = $brandsQuery->get();
        $data = $brands->map(fn($brand) => $this->formatBrand($brand));

        return response()->json(['data' => $data], 200);
    }

    /**
     * Create brand.
     */
    public function createBrands(Request $request) {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['msg' => 'Token is required.'], 401);
        }

        if (!in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json(['msg' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'name' => 'required|string|unique:brands,name',
            'description' => 'nullable|string',
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:102400',
        ]);

        $brand = new Brands();
        $brand->name = $request->name;
        $brand->description = $request->description;
        $brand->seller_id = $user->user_id;
        $brand->status = $user->role === 'admin' ? 'approved' : 'pending';
        $brand->is_active = true;
        $brand->approval_reason = null;
        $brand->approved_by = $user->role === 'admin' ? $user->user_id : null;

        $destinationPath = public_path('FrontEnd/assets/img/brand');
        if (!File::exists($destinationPath)) {
            File::makeDirectory($destinationPath, 0755, true);
        }

        $image = $request->file('image');
        $imageName = time() . '.' . $image->getClientOriginalExtension();
        if (!$image->move($destinationPath, $imageName)) {
            return response()->json(['msg' => 'Failed to upload image.'], 500);
        }

        $brand->image = $imageName;
        $brand->save();
        
        if ($user->role === 'seller') {
            try {
                $admins = User::where('role', 'admin')->get();

                foreach ($admins as $admin) {
                    app(PushNotificationService::class)->sendToUser(
                        $admin->user_id,
                        'New Brand Request',
                        'A seller submitted a new brand for approval.',
                        'brand.html',
                        'brand_request',
                        $brand->brand_id
                    );
                }
            } catch (\Exception $notificationError) {
                \Log::error('Brand request FCM notification failed: ' . $notificationError->getMessage());
            }
        }

        $brand->load(['seller', 'approver']);

        return response()->json([
            'msg' => 'Brand created successfully.',
            'brand' => $this->formatBrand($brand),
        ], 201);
    }

    /**
     * Get brand by ID.
     */
    public function getBrands_id(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);

        $brandQuery = Brands::with(['seller', 'approver'])
            ->where('brand_id', $id);
        if ($user && $user->role === 'seller') {

            $brandQuery->where('seller_id', $user->user_id);

        } elseif (!$this->canViewAllBrands($user)) {

            $brandQuery
                ->where('status', 'approved')
                ->where('is_active', true);
        }

        $brand = $brandQuery->first();
        if (!$brand) {
            return response()->json(['message' => 'Brand not found'], 404);
        }

        return response()->json($this->formatBrand($brand), 200);
    }

    /**
     * Update brand.
     */
    public function updateBrands(Request $request, $id) {

        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 400);
        }

        $brand = Brands::find($id);

        if (!$brand) {
            return response()->json([
                'msg' => 'Brand not found.'
            ], 404);
        }

        if (!$this->canManageBrand($user, $brand)) {
            return response()->json([
                'msg' => 'Unauthorized. Sellers can only update their own brands.'
            ], 403);
        }

        // Remember the status before the seller edits the brand.
        $oldStatus = strtolower($brand->status ?? 'pending');

        $request->validate([
            'editName' => 'required|string|unique:brands,name,' . $id . ',brand_id',
            'editDescription' => 'nullable|string',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:102400',
        ]);

        $brand->name = $request->editName;

        if ($request->has('editDescription')) {
            $brand->description = $request->editDescription;
        }

        if ($request->hasFile('image')) {
            $destinationPath = public_path('FrontEnd/assets/img/brand');

            if (!File::exists($destinationPath)) {
                File::makeDirectory($destinationPath, 0755, true);
            }

            $image = $request->file('image');
            $imageName = time() . '.' . $image->getClientOriginalExtension();

            if (!$image->move($destinationPath, $imageName)) {
                return response()->json([
                    'msg' => 'Failed to upload image.'
                ], 500);
            }

            $brand->image = $imageName;
        }

        /*
        * IMPORTANT:
        * Any change made by a seller requires admin review again.
        *
        * Pending  -> Pending
        * Approved -> Pending
        * Rejected -> Pending
        */
        if ($user->role === 'seller') {
            $brand->status = 'pending';
            $brand->approval_reason = null;
            $brand->approved_by = null;
        }

        $brand->save();

        /*
        * Notify administrators that the seller submitted
        * brand changes for review.
        */
        if ($user->role === 'seller') {
            try {
                $admins = User::where('role', 'admin')->get();

                if ($oldStatus === 'approved') {
                    $notificationTitle = 'Brand Edit Request';
                    $notificationMessage =
                        'Seller "' . $user->username .
                        '" submitted changes to approved brand "' .
                        $brand->name . '" for review.';
                    $notificationType = 'brand_edit_request';

                } elseif ($oldStatus === 'rejected') {
                    $notificationTitle = 'Brand Resubmitted';
                    $notificationMessage =
                        'Seller "' . $user->username .
                        '" resubmitted brand "' .
                        $brand->name . '" for approval.';
                    $notificationType = 'brand_resubmitted';

                } else {
                    $notificationTitle = 'Brand Updated';
                    $notificationMessage =
                        'Seller "' . $user->username .
                        '" updated pending brand "' .
                        $brand->name . '".';
                    $notificationType = 'brand_updated';
                }

                foreach ($admins as $admin) {
                    app(PushNotificationService::class)->sendToUser(
                        $admin->user_id,
                        $notificationTitle,
                        $notificationMessage,
                        'brand.html',
                        $notificationType,
                        $brand->brand_id
                    );
                }

            } catch (\Exception $notificationError) {
                \Log::error(
                    'Brand update FCM notification failed: ' .
                    $notificationError->getMessage()
                );
            }
        }

        $brand->load(['seller', 'approver']);

        if ($user->role === 'seller') {

            if ($oldStatus === 'approved') {
                $message =
                    'Brand changes submitted successfully and are now pending admin approval.';

            } elseif ($oldStatus === 'rejected') {
                $message =
                    'Brand resubmitted successfully and is now pending admin approval.';

            } else {
                $message =
                    'Brand updated successfully and remains pending admin approval.';
            }

        } else {
            $message = 'Brand updated successfully.';
        }

        return response()->json([
            'msg' => $message,
            'brand' => $this->formatBrand($brand),
            'status' => 200,
        ], 200);
    }

    /**
     * Approve brand (admin action).
     */
    public function approveBrand(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['msg' => 'No Token Provided or Invalid Token.'], 400);
        }

        if ($user->role !== 'admin') {
            return response()->json(['msg' => 'Unauthorized.'], 403);
        }

        $brand = Brands::find($id);
        if (!$brand) {
            return response()->json(['msg' => 'Brand not found.'], 404);
        }

        $oldStatus = $brand->status;

        $brand->status = 'approved';
        $brand->approval_reason = null;
        $brand->approved_by = $user->user_id;
        $brand->save();

        if ($brand->seller_id && $oldStatus !== 'approved') {
            try {
                    app(PushNotificationService::class)->sendToUser(
                    $brand->seller_id,
                    'Brand Approved',
                    'Your brand "' . $brand->name . '" has been approved.',
                    'brand.html',
                    'brand_approved',
                    $brand->brand_id
                );
            } catch (\Exception $notificationError) {
                \Log::error('Brand approval FCM notification failed: ' . $notificationError->getMessage());
            }
        }
        return response()->json(['msg' => 'Brand approved.'], 200);
    }

    /**
     * Reject brand (admin action).
     */
    public function rejectBrand(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['msg' => 'No Token Provided or Invalid Token.'], 400);
        }

        if ($user->role !== 'admin') {
            return response()->json(['msg' => 'Unauthorized.'], 403);
        }

        $brand = Brands::find($id);
        if (!$brand) {
            return response()->json(['msg' => 'Brand not found.'], 404);
        }

        $oldStatus = $brand->status;

        $data = $request->all();
        $reason = $data['reason'] ?? null;

        $brand->status = 'rejected';
        $brand->approval_reason = $reason;
        $brand->approved_by = $user->user_id;
        $brand->save();

        if ($brand->seller_id && $oldStatus !== 'rejected') {
            try { 
                app(PushNotificationService::class)->sendToUser(
                    $brand->seller_id,
                    'Brand Rejected',
                    'Your brand "' . $brand->name . '" was rejected.',
                    'brand.html',
                    'brand_rejected',
                    $brand->brand_id
            );
            } catch (\Exception $notificationError) {
                \Log::error('Brand rejection FCM notification failed: ' . $notificationError->getMessage());
            }
        }
        
        return response()->json(['msg' => 'Brand rejected.'], 200);
    }

    /**
     * Deactivate an approved brand.
     */
    public function deactivateBrand(Request $request, $id) {
        
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 401);
        }

        if ($user->role !== 'seller') {
            return response()->json([
                'msg' => 'Only sellers can deactivate brands.'
            ], 403);
        }

        $brand = Brands::find($id);

        if (!$brand) {
            return response()->json([
                'msg' => 'Brand not found.'
            ], 404);
        }

        // Seller can only manage their own brand.
        if ((int) $brand->seller_id !== (int) $user->user_id) {
            return response()->json([
                'msg' => 'Unauthorized. You can only deactivate your own brands.'
            ], 403);
        }

        // Only an approved brand can be deactivated.
        if (strtolower($brand->status ?? '') !== 'approved') {
            return response()->json([
                'msg' => 'Only approved brands can be deactivated.'
            ], 422);
        }

        if (!$brand->is_active) {
            return response()->json([
                'msg' => 'This brand is already deactivated.'
            ], 200);
        }

        $brand->is_active = false;
        $brand->save();

        $brand->load(['seller', 'approver']);

        return response()->json([
            'msg' => 'Brand deactivated successfully.',
            'brand' => $this->formatBrand($brand),
        ], 200);
    }

    /**
     * Reactivate an approved brand.
     */
    public function reactivateBrand(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 401);
        }

        if ($user->role !== 'seller') {
            return response()->json([
                'msg' => 'Only sellers can reactivate brands.'
            ], 403);
        }

        $brand = Brands::find($id);

        if (!$brand) {
            return response()->json([
                'msg' => 'Brand not found.'
            ], 404);
        }

        // Seller can only manage their own brand.
        if ((int) $brand->seller_id !== (int) $user->user_id) {
            return response()->json([
                'msg' => 'Unauthorized. You can only reactivate your own brands.'
            ], 403);
        }

        // Very important:
        // Pending/rejected brands cannot bypass approval.
        if (strtolower($brand->status ?? '') !== 'approved') {
            return response()->json([
                'msg' => 'Only approved brands can be reactivated.'
            ], 422);
        }

        if ($brand->is_active) {
            return response()->json([
                'msg' => 'This brand is already active.'
            ], 200);
        }

        $brand->is_active = true;
        $brand->save();

        $brand->load(['seller', 'approver']);

        return response()->json([
            'msg' => 'Brand reactivated successfully.',
            'brand' => $this->formatBrand($brand),
        ], 200);
    }

    /**
     * Delete brand.
     */
    public function deleteBrands(Request $request, $id) {

        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['msg' => 'Token is required.'], 401);
        }

        $brand = Brands::find($id);
        if (!$brand) {
            return response()->json(['msg' => 'Brand not found.'], 404);
        }

        if (!$this->canManageBrand($user, $brand)) {
            return response()->json(['msg' => 'Unauthorized. Sellers can only delete their own brands.'], 403);
        }

        // Sellers cannot permanently delete an approved brand.
        if (
            $user->role === 'seller' &&
            strtolower($brand->status ?? '') === 'approved'
        ) {
            return response()->json([
                'msg' => 'Approved brands cannot be permanently deleted. Deactivate the brand instead.'
            ], 403);
        }

        $brand->delete();
        return response()->json(['msg' => 'Brand was successfully deleted.'], 200);
    }
}
