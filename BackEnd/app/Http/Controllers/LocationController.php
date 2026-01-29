<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Http\FileException;
use Illuminate\Support\Facades\Storage;
use Illuminate\Auth\AuthenticationException;

class LocationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index() {
        $token = request()->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){ 
                $locations = Location::where('user_id', auth()->id())->get();
                return response()->json(['data' => $locations]);
            } else {
                return response()->json([
                    'msg' => 'No Location.'
                ], 400);
            }
        } else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }

    /**
     * Get locations for a specific user.
     */
    public function getUserLocations(Request $request) {
        $token = request()->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){ 
                $locations = Location::where('user_id', $user->user_id)->get();

                // Add fullname & phone_number to each location
                $locations->transform(function ($location) use ($user) {
                    $location->fullname = $user->fullname;
                    $location->phone_number = $user->phone_number;
                    return $location;
                });

                \Log::info('Fetched locations for user: ' . $user->id . ' | Count: ' . $locations->count());

                return response()->json(['data' => $locations]);
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
     * Get locations for a specific Fetch.
     */
    public function getLocation_id(Request $request, $id) {
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $location = Location::find($id);
                if($location){
                    return response()->json($location, 200);
                } else {
                    return response()->json(['message' => 'Location not found'], 404);
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
     * Store a newly created resource in storage.
     */
    public function createLocation(Request $request) {
        $token = $request->bearerToken();
        if ($token) {
            $user = User::where('token', $token)->first();
            if ($user) {
                $request->validate([
                    'purok' => 'required|string',
                    'barangay' => 'required|string',
                    'city' => 'required|string',
                    'province' => 'required|string',
                    'zipcode' => 'nullable|string|max:10',
                ]);

                $location = new Location();
                $location->user_id = $user->user_id;
                $location->purok = $request->purok;
                $location->barangay = $request->barangay;
                $location->city = $request->city;
                $location->province = $request->province;
                $location->zipcode = $request->zipcode;
                $location->save();
                return response()->json([
                    'msg' => 'New Location was successfully saved.',
                    'category' => $location
                ], 201);
            } else {
                return response()->json(['msg' => 'Invalid Token.'], 400);
            }
        } else {
            return response()->json(['msg' => 'No Token Provided.'], 400);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function updateLocation (Request $request, $id) {
        $token = $request->bearertoken();
        if ($token) {
            $user = User::where('token', $token)->first();
            if ($user) {
                $request->validate([
                    'editPurok' => 'required|string',
                    'editBarangay' => 'required|string',
                    'editCity' => 'required|string',
                    'editProvince' => 'required|string',
                    'editZipcode' => 'nullable|string|max:10',
                ]);

                $location = Location::find($id);

                if (!$location) {
                    return response()->json(['msg' => 'Location not found.'], 404);
                }

                $location->purok = $request->editPurok;
                $location->barangay = $request->editBarangay;
                $location->city = $request->editCity;
                $location->province = $request->editProvince;
                $location->zipcode = $request->editZipcode;
                $location->save();
                
                return response()->json(['message' => 'Location updated successfully', 'location' => $location, 'status' => 200]);
            }
        }
    }

    /**
     * Set Default Address specified resource from storage.
     */
    public function setDefaultAddress(Request $request, $id) {
        $token = $request->bearerToken();
        if ($token) {
            $user = User::where('token', $token)->first();
            if ($user) {
                // Find the location by location_id and ensure it belongs to the authenticated user
                $location = Location::where('location_id', $id)
                    ->where('user_id', $user->user_id)
                    ->firstOrFail();

                // Set all user's locations to not default
                Location::where('user_id', $user->user_id)->update(['is_default' => false]);

                // Set this one as default
                $location->update(['is_default' => true]);

                return response()->json(['message' => 'Address set as default successfully']);
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
    public function deleteLocation(Request $request, $id) {
        $token = $request->bearerToken();
        if ($token) {
            $user = User::where('token', $token)->first();
            if ($user) {
                $location = Location::find($id);
                if ($location) {
                    $location->delete();
                    return response()->json('Location Successfully Deleted!', 200);
                } else {
                    return response()->json(['msg' => 'Location Not Found.'], 404);
                }
            } else {
                return response()->json(['msg' => 'Invalid Token.'], 400);
            }
        } else {
            return response()->json(['msg' => 'No Token Provided.'], 400);
        }
    }
}
