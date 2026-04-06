<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Player;
use App\Models\Purchase;
use App\Models\IngestEvent;
use App\Models\RankHistory;
use App\Models\ActivityLog;
use App\Models\ScoringRule;
use App\Services\RatingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function __construct(private RatingService $ratingService) {}

    /**
     * GET /api/admin/ping — проверка токена
     */
    public function ping(): JsonResponse
    {
        return response()->json(['status' => 'ok']);
    }

    /**
     * GET /api/admin/purchases — аудит покупок
     */
    public function purchases(Request $request): JsonResponse
    {
        $limit = min((int) ($request->query('limit', 120)), 200);
        $query = Purchase::with('player')->orderByDesc('created_at');

        if ($request->query('source')) {
            $query->where('source', $request->query('source'));
        }

        return response()->json($query->limit($limit)->get());
    }

    /**
     * GET /api/admin/ingest-events — сырые ingestion-события
     */
    public function ingestEvents(Request $request): JsonResponse
    {
        $limit = min((int) ($request->query('limit', 120)), 200);
        $query = IngestEvent::orderByDesc('created_at');

        if ($request->query('source')) {
            $query->where('source', $request->query('source'));
        }
        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->limit($limit)->get());
    }

    /**
     * GET /api/admin/rank-history — история рангов
     */
    public function rankHistory(Request $request): JsonResponse
    {
        $limit = min((int) ($request->query('limit', 120)), 200);
        $query = RankHistory::with('player')->orderByDesc('changed_at');

        if ($request->query('player_id')) {
            $query->where('player_id', $request->query('player_id'));
        }

        return response()->json($query->limit($limit)->get());
    }

    /**
     * GET /api/admin/activity-insights — аналитика
     */
    public function activityInsights(Request $request): JsonResponse
    {
        $days = min((int) ($request->query('days', 7)), 30);
        $since = now()->subDays($days);

        $purchases = Purchase::where('created_at', '>=', $since)->count();
        $adjustments = ActivityLog::where('type', 'adjustment')
            ->where('logged_at', '>=', $since)->count();
        $totalDelta = ActivityLog::where('logged_at', '>=', $since)
            ->whereNotNull('delta')->sum('delta');

        $topMovers = Player::orderByDesc('rating')
            ->limit(10)->get(['id', 'nickname', 'rating', 'rank', 'faction', 'tier']);

        return response()->json([
            'window_days' => $days,
            'purchases' => $purchases,
            'adjustments' => $adjustments,
            'total_delta' => $totalDelta,
            'top_movers' => $topMovers,
            'last_update' => now()->toIso8601String(),
        ]);
    }

    /**
     * POST /api/admin/adjust — ручная корректировка рейтинга
     */
    public function adjust(Request $request): JsonResponse
    {
        $data = $request->validate([
            'player_id' => 'required|uuid|exists:players,id',
            'delta' => 'required|integer|not_in:0',
            'reason' => 'required|string|max:500',
        ]);

        $result = $this->ratingService->adjustRating($data['player_id'], $data['delta'], $data['reason']);
        return response()->json($result);
    }

    /**
     * POST /api/admin/manual-add — добавить игрока вручную
     */
    public function manualAdd(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nickname' => 'required|string|max:100',
            'rating' => 'nullable|integer|min:0',
            'faction' => 'nullable|in:darkness,light',
            'tier' => 'nullable|in:legendary,noble,treasure',
            'phone' => 'nullable|string|max:20',
            'avatar' => 'nullable|string|max:500',
            'parent_id' => 'nullable|uuid|exists:players,id',
        ]);

        $player = $this->ratingService->findOrCreatePlayer($data);

        if (isset($data['rating'])) {
            $player->rating = $data['rating'];
        }
        if (isset($data['tier'])) {
            $player->tier = $data['tier'];
        }
        if (isset($data['avatar'])) {
            $player->avatar = $data['avatar'];
        }
        if (isset($data['parent_id'])) {
            $player->parent_id = $data['parent_id'];
        }
        $player->save();

        ActivityLog::create([
            'id' => Str::uuid(),
            'type' => 'manual_add',
            'player_id' => $player->id,
            'player_nickname' => $player->nickname,
            'description' => "Игрок добавлен вручную",
            'logged_at' => now(),
        ]);

        $this->ratingService->recalculateRanks();

        return response()->json(['status' => 'ok', 'player' => $player->fresh()], 201);
    }

    /**
     * PATCH /api/admin/rules — обновить правила начисления
     */
    public function updateRules(Request $request): JsonResponse
    {
        $data = $request->validate([
            'base_points_per_dollar' => 'nullable|integer|min:1',
            'website_bonus_percent' => 'nullable|integer|min:0',
            'telegram_bonus_percent' => 'nullable|integer|min:0',
            'high_value_threshold' => 'nullable|integer|min:0',
            'high_value_bonus_percent' => 'nullable|integer|min:0',
            'decay_per_day' => 'nullable|integer|min:0',
        ]);

        $rules = ScoringRule::firstOrCreate(['id' => 1]);
        $rules->fill($data);
        $rules->save();

        ActivityLog::create([
            'id' => Str::uuid(),
            'type' => 'rule_change',
            'player_nickname' => 'admin',
            'description' => 'Правила начисления обновлены',
            'logged_at' => now(),
        ]);

        return response()->json(['status' => 'ok', 'rules' => $rules->fresh()]);
    }

    /**
     * PATCH /api/admin/players/{id} — обновить профиль игрока
     */
    public function updatePlayer(Request $request, string $id): JsonResponse
    {
        $player = Player::findOrFail($id);

        $data = $request->validate([
            'nickname' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:20',
            'faction' => 'nullable|in:darkness,light',
            'tier' => 'nullable|in:legendary,noble,treasure',
            'avatar' => 'nullable|string|max:500',
            'parent_id' => 'nullable|uuid|exists:players,id',
        ]);

        $player->fill($data);
        $player->save();

        $this->ratingService->recalculateRanks();

        return response()->json(['status' => 'ok', 'player' => $player->fresh()]);
    }

    /**
     * DELETE /api/admin/players/{id} — удалить игрока
     */
    public function deletePlayer(string $id): JsonResponse
    {
        $player = Player::findOrFail($id);
        $nickname = $player->nickname;
        $player->delete();

        ActivityLog::create([
            'id' => Str::uuid(),
            'type' => 'adjustment',
            'player_nickname' => $nickname,
            'description' => "Игрок {$nickname} удалён",
            'logged_at' => now(),
        ]);

        $this->ratingService->recalculateRanks();

        return response()->json(['status' => 'ok']);
    }
}
