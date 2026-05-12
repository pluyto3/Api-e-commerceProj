<?php

namespace App\Http\Controllers;

use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Http\Request;
use Kreait\Laravel\Firebase\Facades\Firebase;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;
use Kreait\Firebase\Messaging\WebPushConfig;

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
            ->withNotification(Notification::create(
                'Hanz-Go Notification',
                'This is a test push notification from your Laravel backend.'
            ))
            ->withData([
                'type' => 'test',
                'url' => 'orderDetails.html',
            ])
            ->withWebPushConfig(WebPushConfig::fromArray([
                'notification' => [
                    'title' => 'Hanz-Go Notification',
                    'body' => 'This is a test push notification from your Laravel backend.',
                    'icon' => 'http://localhost/e-commerce/FrontEnd/assets/img/hanz-goLogo.png',
                ],
                'fcm_options' => [
                    'link' => 'http://localhost/e-commerce/FrontEnd/orderDetails.html',
                ],
            ]))
            ->toToken($fcmToken);

        Firebase::messaging()->send($message);

        return response()->json([
            'message' => 'Test notification sent successfully.',
        ]);
    }

    public function store(Request $request) {

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

    public function destroy(Request $request) {

        $request->validate([
            'token' => 'required|string',
        ]);

        FcmToken::where('token', $request->token)->delete();

        return response()->json([
            'message' => 'FCM token removed successfully.',
        ]);
    }
}