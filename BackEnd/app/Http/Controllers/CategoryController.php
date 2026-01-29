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
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request){

        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                // $contegories = Category::paginate(10);
                return response()->json(['data' => Category::all()]);
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
     * Store a newly created resource in storage.
     */
    public function createCategory(Request $request){
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $request->validate([
                    'name' => 'required|string|unique:categories,name',
                    'description' => 'nullable|string',
                    'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:102400'
                ]);
                $category = new Category();
                $category->name = $request->name;
                $category->description = $request->description;
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
                    $category->image = $imageName;
                } else {
                    return response()->json(['msg' => 'Failed to upload image.', 'path' => $destinationPath], 400);
                }
                $category->save();
                return response()->json([
                    'msg' => 'New Category was successfully saved.',
                    'category' => $category
                ], 201);
                // $category = Category::create([
                //     'name' => $request->name,
                //     'description' => $request->description,
                //     'image_url' => $imagePath
                // ]);

                return response()->json($category, 201);
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
     * Display the specified resource.
     */
    public function getCategory_id(Request $request, $id) {
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $category = Category::find($id);
                if($category){
                    return response()->json($category, 200);
                } else {
                    return response()->json(['message' => 'Category not found'], 404);
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
    public function updateCategory(Request $request, $id) {
        // \Log::info(' Token received: ' . $request->bearerToken());
        // \Log::info(' Headers:', $request->headers->all());
        $token = $request->bearerToken();
        if ($token) {
            $user = User::where('token', $token)->first();
            if ($user) {
                $category = Category::find($id);
                
                if (!$category) {
                    return response()->json(['msg' => 'Category not found.'], 404);
                }

                $request->validate([
                    'editName' => 'required|string|unique:categories,name,' . $id . ',category_id',
                    'editDescription' => 'nullable|string',
                    'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:102400'
                ]);

                // Log the request data for debugging
                // \Log::info('Request Data:', $request->all());

                $category->name = $request->editName;
                $category->description = $request->editDescription;

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

                return response()->json([
                    'msg' => 'Category updated successfully.',
                    'category' => $category,
                    'status' => 200
                ]);
            } else {
                return response()->json([
                    'msg' => 'Invalid Token.',
                    'status' => 400
                ]);
            }
        } else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
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
