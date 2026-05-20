<?php

namespace App\Http\Controllers;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private function getAuthenticatedUser(Request $request)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return null;
        }

        return User::where('token', $token)->first();
    }

    /**
     * Get latest notifications of logged-in user.
     */
    public function index(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        $notifications = AppNotification::where('user_id', $user->user_id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        $unreadCount = AppNotification::where('user_id', $user->user_id)
            ->where('is_read', false)
            ->count();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
        ], 200);
    }

    /**
     * Get unread notification count.
     */
    public function unreadCount(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        $count = AppNotification::where('user_id', $user->user_id)
            ->where('is_read', false)
            ->count();

        return response()->json([
            'unread_count' => $count,
        ], 200);
    }

    /**
     * Mark one notification as read.
     */
    public function markAsRead(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        $notification = AppNotification::where('id', $id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$notification) {
            return response()->json(['msg' => 'Notification not found.'], 404);
        }

        $notification->is_read = true;
        $notification->read_at = now();
        $notification->save();

        return response()->json([
            'msg' => 'Notification marked as read.',
            'notification' => $notification,
        ], 200);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json(['msg' => 'Invalid Token.'], 401);
        }

        AppNotification::where('user_id', $user->user_id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return response()->json([
            'msg' => 'All notifications marked as read.',
        ], 200);
    }
}