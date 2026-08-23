<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\FcmToken;
use Illuminate\Support\Facades\Log;
use Kreait\Laravel\Firebase\Facades\Firebase;
use Kreait\Firebase\Messaging\CloudMessage;

class PushNotificationService
{
    public function sendToUser(
        $userId,
        $title,
        $message,
        $url = null,
        $type = null,
        $relatedId = null
    ) {
        /*
        |--------------------------------------------------------------------------
        | 1. Save notification in database
        |--------------------------------------------------------------------------
        |
        | This is used by the Hanz-Go notification bell/history.
        |
        */
        $notification = AppNotification::create([
            'user_id' => $userId,
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'related_id' => $relatedId,
            'url' => $url,
        ]);

        /*
        |--------------------------------------------------------------------------
        | 2. Find the user's FCM token
        |--------------------------------------------------------------------------
        */
        $tokens = FcmToken::where('user_id', $userId)
            ->pluck('token')
            ->filter()
            ->values();

        if ($tokens->isEmpty()) {
            Log::warning(
                "No FCM tokens found for user_id: {$userId}"
            );

            // Notification still remains in the notification bell.
            return $notification;
        }

        /*
        |--------------------------------------------------------------------------
        | 3. Build frontend URL
        |--------------------------------------------------------------------------
        */
        $frontendUrl = rtrim(
            config('app.frontend_url', 'https://hanzgo.me'),
            '/'
        );

        $fullUrl = $url
            ? $frontendUrl . '/' . ltrim($url, '/')
            : $frontendUrl . '/index.html';

        /*
        |--------------------------------------------------------------------------
        | 4. Send DATA-ONLY Firebase message
        |--------------------------------------------------------------------------
        |
        | firebase-notification.js handles foreground messages.
        | firebase-messaging-sw.js handles background/closed-tab messages.
        |
        */
        foreach ($tokens as $token) {
            try {

                $fcmMessage = CloudMessage::new()
                    ->withData([
                        'title' => (string) $title,
                        'body' => (string) $message,
                        'message' => (string) $message,

                        'type' => (string) (
                            $type ?? 'general'
                        ),

                        'url' => (string) $fullUrl,

                        'related_id' => (string) (
                            $relatedId ?? ''
                        ),

                        'notification_id' => (string) (
                            $notification->id
                        ),
                    ])
                    ->toToken($token);

                Firebase::messaging()->send($fcmMessage);

                Log::info(
                    "FCM notification sent to user_id {$userId}"
                );

            } catch (\Throwable $e) {

                Log::error(
                    "FCM notification failed for user_id {$userId}: "
                    . $e->getMessage()
                );
            }
        }

        return $notification;
    }
}
