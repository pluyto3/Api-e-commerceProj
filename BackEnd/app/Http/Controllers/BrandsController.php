<?php

namespace App\Http\Controllers;

use App\Models\Brands;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

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
        return $user && in_array($user->role, ['admin', 'seller'], true);
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

        $brandsQuery = Brands::with(['seller', 'approver']);
        if (!$this->canViewAllBrands($user)) {
            $brandsQuery->where('status', 'approved');
        }

        $brands = $brandsQuery->get();
        $data = $brands->map(fn($brand) => $this->formatBrand($brand));

        return response()->json(['data' => $data], 200);
    }

    /**
     * Create brand.
     */
    public function createBrands(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['msg' => 'Token is required.'], 401);
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
        $brand->status = 'pending';
        $brand->approval_reason = null;
        $brand->approved_by = null;

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
        if (!$this->canViewAllBrands($user)) {
            $brandQuery->where('status', 'approved');
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
    public function updateBrands(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['msg' => 'No Token Provided or Invalid Token.'], 400);
        }

        $brand = Brands::find($id);
        if (!$brand) {
            return response()->json(['msg' => 'Brand not found.'], 404);
        }

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
                return response()->json(['msg' => 'Failed to upload image.'], 500);
            }
            $brand->image = $imageName;
        }

        $brand->save();
        $brand->load(['seller', 'approver']);

        return response()->json([
            'msg' => 'Brand updated successfully.',
            'brand' => $this->formatBrand($brand),
            'status' => 200,
        ]);
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

        $brand->status = 'approved';
        $brand->approval_reason = null;
        $brand->approved_by = $user->user_id;
        $brand->save();

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

        $data = $request->all();
        $reason = $data['reason'] ?? null;

        $brand->status = 'rejected';
        $brand->approval_reason = $reason;
        $brand->approved_by = $user->user_id;
        $brand->save();

        return response()->json(['msg' => 'Brand rejected.'], 200);
    }

    /**
     * Delete brand.
     */
    public function deleteBrands(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['msg' => 'Token is required.'], 401);
        }

        $brand = Brands::find($id);
        if (!$brand) {
            return response()->json(['msg' => 'Brand not found.'], 404);
        }

        $brand->delete();
        return response()->json(['msg' => 'Brand was successfully deleted.'], 200);
    }
}
