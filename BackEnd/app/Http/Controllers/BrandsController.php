<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Brands;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;


class BrandsController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {

        $token = request()->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){ 
                return response()->json(['data' => Brands::all()]);
            } else {
                return response()->json([
                    'msg' => 'No Brand.'
                ], 400);
            }
        } else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
        // return response()->json(\App\Models\Brands::all());
        // $brands = Brands::paginate(10);
        // return response()->json($brands, 200);
    }
    
    /**
     * Store a newly created resource in storage.
     */
    public function createBrands(Request $request) {
        $token = $request->bearerToken();
        if (!$token) {
            return response()->json(['msg' => 'Token is required.'], 401);
        }
        if ($token) {
            $user = User::where('token', $token)->first();
            if ($user) {
                $request->validate([
                    'name' => 'required|string|unique:brands,name',
                ]);
                $brand = new Brands;
                $brand->name = $request->name;
                if ($request->hasFile('image')) {
                    $image = $request->file('image');
                    $imageName = time() . '.' . $image->getClientOriginalExtension();
                    $destinationPath = public_path('FrontEnd/assets/img/brand');
                    if (!File::exists($destinationPath)) {
                        File::makeDirectory($destinationPath, 0755, true);
                    }
                    if (!$image->move($destinationPath, $imageName)) {
                        return response()->json(['msg' => 'Failed to upload image.'], 500);
                    }
                    $brand->image = $imageName;
                } else {
                    return response()->json(['msg' => 'Failed to upload image.', 'path' => $destinationPath], 400);
                }
                $brand->save(); 
                return response()->json([
                    'msg' => 'User successfully register.'
                ], 200);
            } else {
                return response()->json(['msg' => 'Error!.'], 400);
            }
        } else {

            return response()->json(['msg' => 'Token is required.'], 401);

        }

    }

    /**
     * Display the specified resource.
     */
    public function getBrands_id(Request $request, $id) {
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $brand = Brands::find($id);
                if($brand){
                    return response()->json($brand, 200);
                } else {
                    return response()->json(['message' => 'Brand not found'], 404);
                }
            } else {
                return response()->json([
                    'msg' => 'Invalid Token.'
                ], 400);
            }
        } else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }   
    
    /**
     * Update the specified resource in storage.
     */
    public function updateBrands(Request $request, $id) {
        $token = request()->bearerToken();
        if ($token) {
            $user = User::where('token', $token)->first();
            if ($user) {
                $brand = Brands::find($id);
                if (!$brand) {
                    return response()->json(['msg' => 'Brand not found.'], 404);
                }

                $request->validate([
                    'editName' => 'required|string|unique:brands,name,' . $id . ',brand_id',
                ]);

                $brand->name = $request->editName;
                $brand->save();
                return response()->json(['message' => 'Brand updated successfully', 'brand' => $brand, 'status' => 200]);
            } else {
                return response()->json(['msg' => 'Invalid Token.'], 400);
            }
        } else {
            return response()->json(['msg' => 'No Token Provided.'], 400);
        }
    } 

    /**
     * Remove the specified resource from storage.
     */
    public function deleteBrands(Request $request, $id) {
        $token = request()->bearerToken();
        if (!$token) {
            return response()->json(['msg' => 'Token is required.'], 401);
        }
        if ($token) {
            $user = User::where('token', $token)->first();
            if ($user) {
                $brand = Brands::find($id);
                if (!$brand) {
                    return response()->json([
                        'msg' => 'Brand not found.'
                    ], 404);
                }
                $brand->delete();
                return response()->json([
                    'msg' => 'Brand was successfully deleted.'
                ], 200);
            } else {
                return response()->json(['msg' => 'Invalid Token.'], 400);
            }
        } else {
            return response()->json(['msg' => 'No Token Provided.'], 400);
        }
    }
}
