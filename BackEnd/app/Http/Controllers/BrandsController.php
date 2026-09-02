<?php

namespace App\Http\Controllers;

use App\Models\Brands;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use App\Services\PushNotificationService;
use Illuminate\Support\Facades\DB;

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

        $brandsQuery = Brands::with([
            'seller',
            'approver'
        ]);

        $isActiveAdmin =
            $user &&
            $user->role === 'admin' &&
            $user->is_active;

        $isActiveSeller =
            $user &&
            $user->role === 'seller' &&
            $user->is_active;

        if ($publicScope) {

            $brandsQuery
                ->where('status', 'approved')
                ->where('is_active', true);

        } elseif ($isActiveAdmin) {

            // No additional filter.
            // Active Admin can see all Brands.

        } elseif ($isActiveSeller) {

            $brandsQuery->where(function ($query) use ($user) {

                // Global approved Brands.
                $query->where(function ($globalQuery) {
                    $globalQuery
                        ->where('status', 'approved')
                        ->where('is_active', true);
                })

                // Seller's own pending/rejected requests.
                ->orWhere(function ($ownQuery) use ($user) {
                    $ownQuery
                        ->where('seller_id', $user->user_id)
                        ->whereIn('status', [
                            'pending',
                            'rejected'
                        ]);
                });
            });

        } else {

            $brandsQuery
                ->where('status', 'approved')
                ->where('is_active', true);
        }

        $brands = $brandsQuery->get();

        $data = $brands->map(
            fn ($brand) => $this->formatBrand($brand)
        );

        return response()->json([
            'data' => $data
        ], 200);
    }

    /**
     * Create brand.
     */
    public function createBrands(Request $request)
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

        if (!in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json([
                'msg' => 'Unauthorized.'
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|unique:brands,name',
            'description' => 'nullable|string',
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:102400',
        ]);

        $brand = new Brands();

        $brand->name = $request->name;
        $brand->description = $request->description;

        $brand->seller_id =
            $user->role === 'seller'
                ? $user->user_id
                : null;

        $brand->status =
            $user->role === 'admin'
                ? 'approved'
                : 'pending';

        $brand->is_active = true;
        $brand->approval_reason = null;

        $brand->approved_by =
            $user->role === 'admin'
                ? $user->user_id
                : null;

        $destinationPath = public_path(
            'FrontEnd/assets/img/brand'
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

        $brand->image = $imageName;

        $brand->save();

        if ($user->role === 'seller') {

            try {
                $admins = User::where('role', 'admin')
                    ->where('is_active', true)
                    ->get();

                foreach ($admins as $admin) {

                    app(PushNotificationService::class)
                        ->sendToUser(
                            $admin->user_id,
                            'New Brand Request',
                            'Seller "' .
                                $user->username .
                                '" submitted brand "' .
                                $brand->name .
                                '" for approval.',
                            'brand.html',
                            'brand_request',
                            $brand->brand_id
                        );
                }

            } catch (\Exception $notificationError) {

                \Log::error(
                    'Brand request FCM notification failed: ' .
                    $notificationError->getMessage()
                );
            }
        }

        $brand->load([
            'seller',
            'approver'
        ]);

        $message =
            $user->role === 'admin'
                ? 'Brand created successfully.'
                : 'Brand submitted successfully and is pending admin approval.';

        return response()->json([
            'msg' => $message,
            'brand' => $this->formatBrand($brand),
        ], 201);
    }

    /**
     * Get brand by ID.
     */
    public function getBrands_id(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);

        $brand = Brands::with([
            'seller',
            'approver'
        ])->find($id);

        if (!$brand) {
            return response()->json([
                'message' => 'Brand not found'
            ], 404);
        }

        $isActiveAdmin =
            $user &&
            $user->role === 'admin' &&
            $user->is_active;

        $isActiveSeller =
            $user &&
            $user->role === 'seller' &&
            $user->is_active;

        $isApprovedAndActive =
            strtolower($brand->status ?? '') === 'approved' &&
            $brand->is_active;

        if ($isActiveAdmin) {
            // Admin may view everything.

        } elseif ($isActiveSeller) {

            $isOwnRequest =
                (int) $brand->seller_id === (int) $user->user_id &&
                in_array(
                    strtolower($brand->status ?? ''),
                    ['pending', 'rejected'],
                    true
                );

            if (!$isApprovedAndActive && !$isOwnRequest) {
                return response()->json([
                    'message' => 'Brand not found'
                ], 404);
            }

        } elseif (!$isApprovedAndActive) {

            return response()->json([
                'message' => 'Brand not found'
            ], 404);
        }

        return response()->json(
            $this->formatBrand($brand),
            200
        );
    }

    /**
     * Update brand.
     */
    public function updateBrands(Request $request, $id)
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

        if (!in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json([
                'msg' => 'Unauthorized.'
            ], 403);
        }

        $brand = Brands::find($id);

        if (!$brand) {
            return response()->json([
                'msg' => 'Brand not found.'
            ], 404);
        }

        $currentStatus = strtolower(
            $brand->status ?? 'pending'
        );

        /*
        * Sellers may only edit their own
        * pending or rejected Brand requests.
        *
        * Once approved, the Brand is global
        * and only an Admin may modify it.
        */
        if ($user->role === 'seller') {

            if ((int) $brand->seller_id !== (int) $user->user_id) {
                return response()->json([
                    'msg' => 'Unauthorized. You can only edit your own Brand requests.'
                ], 403);
            }

            if ($currentStatus === 'approved') {
                return response()->json([
                    'msg' => 'Approved Brands are global and can only be edited by an administrator.'
                ], 403);
            }

            if (!in_array(
                $currentStatus,
                ['pending', 'rejected'],
                true
            )) {
                return response()->json([
                    'msg' => 'This Brand cannot be edited.'
                ], 422);
            }
        }

        $request->validate([
            'editName' =>
                'required|string|unique:brands,name,' .
                $id .
                ',brand_id',

            'editDescription' => 'nullable|string',

            'image' =>
                'nullable|image|mimes:jpeg,png,jpg,gif|max:102400',
        ]);

        $brand->name = $request->editName;

        if ($request->has('editDescription')) {
            $brand->description =
                $request->editDescription;
        }

        if ($request->hasFile('image')) {

            $destinationPath = public_path(
                'FrontEnd/assets/img/brand'
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

            /*
            * Delete the old image only after
            * the new image uploaded successfully.
            */
            if ($brand->image) {

                $oldImagePath = public_path(
                    'FrontEnd/assets/img/brand/' .
                    $brand->image
                );

                if (File::exists($oldImagePath)) {
                    File::delete($oldImagePath);
                }
            }

            $brand->image = $imageName;
        }

        /*
        * Seller editing pending/rejected request:
        * resubmit it for Admin review.
        */
        if ($user->role === 'seller') {

            $wasRejected =
                $currentStatus === 'rejected';

            $brand->status = 'pending';
            $brand->approval_reason = null;
            $brand->approved_by = null;

        } else {

            /*
            * Admin edits an approved/global Brand
            * without requiring another approval.
            */
            if ($currentStatus === 'approved') {
                $brand->status = 'approved';
                $brand->approval_reason = null;
                $brand->approved_by = $user->user_id;
            }
        }

        $brand->save();

        /*
        * Notify active Admins when a Seller
        * submits or resubmits a Brand request.
        */
        if ($user->role === 'seller') {

            try {

                $admins = User::where('role', 'admin')
                    ->where('is_active', true)
                    ->get();

                $notificationTitle =
                    $wasRejected
                        ? 'Brand Resubmitted'
                        : 'Brand Updated';

                $notificationMessage =
                    $wasRejected
                        ? 'Seller "' .
                            $user->username .
                            '" resubmitted brand "' .
                            $brand->name .
                            '" for approval.'
                        : 'Seller "' .
                            $user->username .
                            '" updated pending brand "' .
                            $brand->name .
                            '".';

                $notificationType =
                    $wasRejected
                        ? 'brand_resubmitted'
                        : 'brand_updated';

                foreach ($admins as $admin) {

                    app(PushNotificationService::class)
                        ->sendToUser(
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

        $brand->load([
            'seller',
            'approver'
        ]);

        if ($user->role === 'seller') {

            $message =
                $wasRejected
                    ? 'Brand resubmitted successfully and is now pending admin approval.'
                    : 'Brand updated successfully and remains pending admin approval.';

        } else {

            $message = 'Brand updated successfully.';
        }

        return response()->json([
            'msg' => $message,
            'brand' => $this->formatBrand($brand),
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
            return response()->json([
                'msg' => 'No Token Provided or Invalid Token.'
            ], 401);
        }

        $brand = Brands::find($id);

        if (!$brand) {
            return response()->json([
                'msg' => 'Brand not found.'
            ], 404);
        }

        $currentStatus = strtolower(
            $brand->status ?? 'pending'
        );

        if ($currentStatus === 'approved') {
            return response()->json([
                'msg' => 'Approved Brands are global and cannot be rejected. Deactivate the Brand instead.'
            ], 409);
        }

        $validated = $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $oldStatus = $brand->status;

        $brand->status = 'rejected';
        $brand->approval_reason = $validated['reason'];
        $brand->approved_by = $user->user_id;

        $brand->save();

        /*
        * Notify the Seller who originally
        * submitted the Brand request.
        */
        if (
            $brand->seller_id &&
            strtolower($oldStatus ?? '') !== 'rejected'
        ) {
            try {

                app(PushNotificationService::class)
                    ->sendToUser(
                        $brand->seller_id,
                        'Brand Rejected',
                        'Your brand "' .
                            $brand->name .
                            '" was rejected. Reason: ' .
                            $validated['reason'],
                        'brand.html',
                        'brand_rejected',
                        $brand->brand_id
                    );

            } catch (\Exception $notificationError) {

                \Log::error(
                    'Brand rejection FCM notification failed: ' .
                    $notificationError->getMessage()
                );
            }
        }

        return response()->json([
            'msg' => 'Brand rejected.'
        ], 200);
    }

    /**
     * Deactivate an approved brand.
     */
    public function deactivateBrand(Request $request, $id)
    {
        $brand = Brands::find($id);

        if (!$brand) {
            return response()->json([
                'msg' => 'Brand not found.'
            ], 404);
        }

        if (strtolower($brand->status ?? '') !== 'approved') {
            return response()->json([
                'msg' => 'Only approved Brands can be deactivated.'
            ], 422);
        }

        if (!$brand->is_active) {
            return response()->json([
                'msg' => 'This Brand is already deactivated.'
            ], 200);
        }

        $brand->is_active = false;
        $brand->save();

        $brand->load([
            'seller',
            'approver'
        ]);

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
        $brand = Brands::find($id);

        if (!$brand) {
            return response()->json([
                'msg' => 'Brand not found.'
            ], 404);
        }

        if (strtolower($brand->status ?? '') !== 'approved') {
            return response()->json([
                'msg' => 'Only approved Brands can be reactivated.'
            ], 422);
        }

        if ($brand->is_active) {
            return response()->json([
                'msg' => 'This Brand is already active.'
            ], 200);
        }

        $brand->is_active = true;
        $brand->save();

        $brand->load([
            'seller',
            'approver'
        ]);

        return response()->json([
            'msg' => 'Brand reactivated successfully.',
            'brand' => $this->formatBrand($brand),
        ], 200);
    }

    /**
     * Delete brand.
     */
    public function deleteBrands(Request $request, $id)
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

        if (!in_array($user->role, ['admin', 'seller'], true)) {
            return response()->json([
                'msg' => 'Unauthorized.'
            ], 403);
        }

        $brand = Brands::find($id);

        if (!$brand) {
            return response()->json([
                'msg' => 'Brand not found.'
            ], 404);
        }

        $status = strtolower(
            $brand->status ?? 'pending'
        );

        /*
        * Seller may permanently delete only
        * their own pending/rejected requests.
        */
        if ($user->role === 'seller') {

            if ((int) $brand->seller_id !== (int) $user->user_id) {
                return response()->json([
                    'msg' => 'Unauthorized. You can only delete your own Brand requests.'
                ], 403);
            }

            if ($status === 'approved') {
                return response()->json([
                    'msg' => 'Approved Brands are global and cannot be permanently deleted by Sellers.'
                ], 403);
            }

            if (!in_array(
                $status,
                ['pending', 'rejected'],
                true
            )) {
                return response()->json([
                    'msg' => 'This Brand cannot be permanently deleted.'
                ], 422);
            }
        }

        /*
        * Never permanently delete a Brand
        * that is already referenced by a Product.
        */
        $isUsedByProducts = DB::table('products')
            ->where('brand_id', $brand->brand_id)
            ->exists();

        if ($isUsedByProducts) {
            return response()->json([
                'msg' => 'This Brand is being used by existing products and cannot be permanently deleted. Deactivate the Brand instead.'
            ], 409);
        }

        /*
        * Remove Brand image when the database
        * record can safely be deleted.
        */
        if ($brand->image) {

            $imagePath = public_path(
                'FrontEnd/assets/img/brand/' .
                $brand->image
            );

            if (File::exists($imagePath)) {
                File::delete($imagePath);
            }
        }

        $brand->delete();

        return response()->json([
            'msg' => 'Brand was successfully deleted.'
        ], 200);
    }
}
