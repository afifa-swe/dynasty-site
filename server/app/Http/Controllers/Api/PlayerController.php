<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Player;
use App\Models\RatingSnapshot;
use App\Services\RatingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlayerController extends Controller
{
    public function __construct(private RatingService $ratingService) {}

    /**
     * GET /api/players — все игроки с рейтингом
     */
    public function index(): JsonResponse
    {
        $players = Player::orderByDesc('rating')->get();
        return response()->json($players);
    }

    /**
     * GET /api/player/{id} — профиль одного игрока
     */
    public function show(string $id): JsonResponse
    {
        $player = Player::findOrFail($id);
        $player->load(['purchases' => fn($q) => $q->latest()->limit(20)]);

        $ratingHistory = RatingSnapshot::where('player_id', $id)
            ->orderByDesc('recorded_at')
            ->limit(25)
            ->get();

        return response()->json([
            'player' => $player,
            'rating_history' => $ratingHistory,
        ]);
    }

    /**
     * POST /api/player — создать или обновить игрока
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nickname' => 'required|string|max:100',
            'phone' => 'nullable|string|max:20',
            'faction' => 'nullable|in:darkness,light',
            'rating' => 'nullable|integer|min:0',
            'tier' => 'nullable|in:legendary,noble,treasure',
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

        $this->ratingService->recalculateRanks();
        $this->ratingService->updateAchievements($player->fresh());

        return response()->json(['status' => 'ok', 'player' => $player->fresh()], 201);
    }
}
