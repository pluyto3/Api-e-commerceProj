<?php

namespace App\Http\Controllers;

use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Http\Request;
use Kreait\Laravel\Firebase\Facades\Firebase;
use Kreait\Firebase\Messaging\CloudMessage;

class FcmTokenController extends Controller
{
    /**
     * Send test push notification.
     * Admin only.
     */
    public function sendTestNotification(Request $request, $userId)
    {
        $bearerToken = $request->bearerToken();

        if (!$bearerToken) {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 401);
        }

        $admin = User::where('token', $bearerToken)->first();

        if (
            !$admin ||
            $admin->role !== 'admin' ||
            !$admin->is_active
        ) {
            return response()->json([
                'msg' => 'Unauthorized. Only active administrators can send test notifications.'
            ], 403);
        }

        $targetUser = User::find($userId);

        if (!$targetUser) {
            return response()->json([
                'message' => 'User not found.'
            ], 404);
        }

        $fcmToken = FcmToken::where('user_id', $userId)
            ->latest('last_used_at')
            ->value('token');

        if (!$fcmToken) {
            return response()->json([
                'message' => 'No FCM token found for this user.'
            ], 404);
        }

        try {
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
                'message' => 'Test notification sent successfully.'
            ], 200);

        } catch (\Throwable $e) {
            \Log::error('Test push notification failed.', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Unable to send test notification.'
            ], 500);
        }
    }

    /**
     * Save FCM token.
     */
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

        // No Authorization header
        if (!$bearerToken) {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 401);
        }

        $user = User::where('token', $bearerToken)->first();

        // Invalid token
        if (!$user) {
            return response()->json([
                'msg' => 'Invalid Token.'
            ], 401);
        }

        // Inactive account
        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
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
            'message' => 'FCM token saved successfully.'
        ], 200);
    }

    /**
     * Remove FCM token.
     */
    public function destroy(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        $bearerToken = $request->bearerToken();

        // No Authorization header
        if (!$bearerToken) {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 401);
        }

        $user = User::where('token', $bearerToken)->first();

        // Invalid token
        if (!$user) {
            return response()->json([
                'msg' => 'Invalid Token.'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated.'
            ], 403);
        }

        FcmToken::where('token', $request->token)
            ->where('user_id', $user->user_id)
            ->delete();

        return response()->json([
            'message' => 'FCM token removed successfully.'
        ], 200);
    }
}