<?php

namespace App\Http\Controllers;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private function authenticatedUser(Request $request)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return null;
        }

        return User::where('token', $token)->first();
    }

    public function index(Request $request)
    {
        $user = $this->authenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid or missing token.',
            ], 401);
        }

        $notifications = AppNotification::where('user_id', $user->user_id)
            ->latest()
            ->limit(20)
            ->get();

        $unreadCount = AppNotification::where('user_id', $user->user_id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'unread_count' => $unreadCount,
            'notifications' => $notifications,
        ]);
    }

    public function markAsRead(Request $request, $id)
    {
        $user = $this->authenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid or missing token.',
            ], 401);
        }

        $notification = AppNotification::where('id', $id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$notification) {
            return response()->json([
                'msg' => 'Notification not found.',
            ], 404);
        }

        $notification->read_at = now();
        $notification->save();

        return response()->json([
            'msg' => 'Notification marked as read.',
        ]);
    }

    public function markAllAsRead(Request $request)
    {
        $user = $this->authenticatedUser($request);

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid or missing token.',
            ], 401);
        }

        AppNotification::where('user_id', $user->user_id)
            ->whereNull('read_at')
            ->update([
                'read_at' => now(),
            ]);

        return response()->json([
            'msg' => 'All notifications marked as read.',
        ]);
    }
}