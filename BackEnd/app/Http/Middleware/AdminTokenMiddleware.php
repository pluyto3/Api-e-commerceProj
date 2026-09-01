<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminTokenMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 401);
        }

        $user = User::where('token', $token)->first();

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

        if ($user->role !== 'admin') {
            return response()->json([
                'msg' => 'Unauthorized. Administrator access required.'
            ], 403);
        }

        // Make authenticated user available to controllers if needed
        $request->attributes->set('authenticated_user', $user);

        return $next($request);
    }
}