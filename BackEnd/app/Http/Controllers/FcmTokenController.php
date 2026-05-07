<?php

namespace App\Http\Controllers;

use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Http\Request;

class FcmTokenController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'platform' => 'nullable|string',
        ]);

        // Get token from Authorization: Bearer ...
        $bearerToken = $request->bearerToken();

        if (!$bearerToken) {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 401);
        }

        // Match your custom login token from users table
        $user = User::where('token', $bearerToken)->first();

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid Token.'
            ], 401);
        }

        FcmToken::updateOrCreate(
            ['token' => $request->token],
            [
                'user_id' => $user->user_id,
                'platform' => $request->platform ?? 'web',
                'last_used_at' => now(),
            ]
        );

        return response()->json([
            'message' => 'FCM token saved successfully.',
            'user_id' => $user->user_id,
        ]);
    }
}