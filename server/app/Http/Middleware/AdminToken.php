<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Простая проверка токена админа через заголовок X-Admin-Token или Bearer
 */
class AdminToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = config('app.admin_api_token');

        if (!$expected) {
            return response()->json(['error' => 'Admin API token not configured'], 500);
        }

        $token = $request->header('X-Admin-Token')
            ?? $request->bearerToken();

        if (!$token || $token !== $expected) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
