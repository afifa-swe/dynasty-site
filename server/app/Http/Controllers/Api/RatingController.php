<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Player;
use App\Models\ActivityLog;
use App\Models\ScoringRule;
use Illuminate\Http\JsonResponse;

class RatingController extends Controller
{
    /**
     * GET /api/rating — таблица рейтингов (leaderboard)
     */
    public function index(): JsonResponse
    {
        $players = Player::orderByDesc('rating')->get();
        $rules = ScoringRule::firstOrCreate(['id' => 1]);
        $activity = ActivityLog::orderByDesc('logged_at')->limit(120)->get();

        return response()->json([
            'leaderboard' => $players,
            'rules' => $rules,
            'activity' => $activity,
        ]);
    }

    /**
     * GET /api/rules — текущие правила начисления
     */
    public function rules(): JsonResponse
    {
        $rules = ScoringRule::firstOrCreate(['id' => 1]);
        return response()->json($rules);
    }

    /**
     * GET /api/activity — лог активности
     */
    public function activity(): JsonResponse
    {
        $activity = ActivityLog::orderByDesc('logged_at')->limit(120)->get();
        return response()->json($activity);
    }
}
