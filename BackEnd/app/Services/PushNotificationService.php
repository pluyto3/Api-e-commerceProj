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

        // 2. Get all FCM tokens for this user
        $tokens = FcmToken::where('user_id', $userId)
            ->pluck('token')
            ->filter()
            ->values();

        if ($tokens->isEmpty()) {
            Log::warning("No FCM tokens found for user_id: {$userId}");
            return $notification;
        }

        // 3. Use live frontend URL from config/app.php and .env
        $frontendUrl = rtrim(config('app.frontend_url', 'https://hanzgo.me'), '/');

        $fullUrl = $url
            ? $frontendUrl . '/' . ltrim($url, '/')
            : $frontendUrl . '/index.html';

        $iconUrl = $frontendUrl . '/assets/img/hanz-goLogo.png';

        // 4. Send FCM push notification
        foreach ($tokens as $token) {
            try {
                $fcmMessage = CloudMessage::new()
                    ->withNotification(
                        FirebaseNotification::create($title, $message)
                    )
                    ->withData([
                        'type' => (string) ($type ?? 'general'),
                        'url' => (string) $fullUrl,
                        'related_id' => (string) ($relatedId ?? ''),
                        'notification_id' => (string) $notification->id,
                    ])
                    ->withWebPushConfig(WebPushConfig::fromArray([
                        'notification' => [
                            'title' => $title,
                            'body' => $message,
                            'icon' => $iconUrl,
                        ],
                        'fcm_options' => [
                            'link' => $fullUrl,
                        ],
                    ]))
                    ->toToken($token);

                Firebase::messaging()->send($fcmMessage);

                Log::info("FCM notification sent to user_id {$userId}");
            } catch (\Throwable $e) {
                Log::error('FCM notification failed: ' . $e->getMessage());
            }
        }

        return $notification;
    }
}
