<?php

namespace App\Http\Controllers;

use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Http\Request;
use Kreait\Laravel\Firebase\Facades\Firebase;
use Kreait\Firebase\Messaging\CloudMessage;

class FcmTokenController extends Controller
{
    public function sendTestNotification($userId) {
        $fcmToken = FcmToken::where('user_id', $userId)
            ->latest('last_used_at')
            ->value('token');

        if (!$fcmToken) {
            return response()->json([
                'message' => 'No FCM token found for this user.',
            ], 404);
        }

        $message = CloudMessage::new()
            ->withData([
                'title' => 'Hanz-Go Notification',
                'body' => 'This is a test push notification from your Laravel backend.',
                'type' => 'test',
                'url' => 'orderDetails.html',
            ])
            ->toToken($fcmToken);

        Firebase::messaging()->send($message);

        return response()->json([
            'message' => 'Test notification sent successfully.',
        ], 200);
    }

    public function store(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'platform' => 'nullable|string',
            'browser_name' => 'nullable|string',
            'device_name' => 'nullable|string',
            'user_agent' => 'nullable|string',
        ]);

        $bearerToken = $request->bearerToken();

        $user = User::where('token', $bearerToken)->first();

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid Token.',
            ], 401);
        }

        FcmToken::updateOrCreate(
            ['token' => $request->token],
            [
                'user_id' => $user->user_id,
                'platform' => $request->platform ?? 'web',
                'browser_name' => $request->browser_name,
                'device_name' => $request->device_name,
                'user_agent' => $request->user_agent,
                'last_used_at' => now(),
            ]
        );

        return response()->json([
            'message' => 'FCM token saved successfully.',
        ]);
    }

    public function destroy(Request $request) {

        $request->validate([
            'token' => 'required|string',
        ]);

        $bearerToken = $request->bearerToken();

        $user = User::where('token', $bearerToken)->first();

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid Token.',
            ], 401);
        }

        FcmToken::where('token', $request->token)
            ->where('user_id', $user->user_id)
            ->delete();

        return response()->json([
            'message' => 'FCM token removed successfully.',
        ], 200);
    }
}