<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\FcmToken;
use Illuminate\Support\Facades\Log;
use Kreait\Laravel\Firebase\Facades\Firebase;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification as FirebaseNotification;
use Kreait\Firebase\Messaging\WebPushConfig;

class PushNotificationService
{
    public function sendToUser($userId, $title, $message, $url = null, $type = null, $relatedId = null)
    {
        // 1. Save notification to database for notification bell/history
        $notification = AppNotification::create([
            'user_id' => $userId,
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'related_id' => $relatedId,
            'url' => $url,
        ]);

        // 2. Send FCM push to all devices/browsers of that user
        $tokens = FcmToken::where('user_id', $userId)->pluck('token');

        $fullUrl = $url
            ? 'http://localhost/e-commerce/FrontEnd/' . ltrim($url, '/')
            : 'http://localhost/e-commerce/FrontEnd/index.html';

        foreach ($tokens as $token) {
            try {
                $fcmMessage = CloudMessage::new()
                    ->withNotification(FirebaseNotification::create($title, $message))
                    ->withData([
                        'type' => $type ?? 'general',
                        'url' => $fullUrl,
                    ])
                    ->withWebPushConfig(WebPushConfig::fromArray([
                        'notification' => [
                            'title' => $title,
                            'body' => $message,
                            'icon' => 'http://localhost/e-commerce/FrontEnd/assets/img/hanz-goLogo.png',
                        ],
                        'fcm_options' => [
                            'link' => $fullUrl,
                        ],
                    ]))
                    ->toToken($token);

                Firebase::messaging()->send($fcmMessage);
            } catch (\Throwable $e) {
                Log::error('FCM notification failed: ' . $e->getMessage());
            }
        }

        return $notification;
    }
}