<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\TreeController;
use App\Http\Controllers\Api\PlayerController;
use App\Http\Controllers\Api\RatingController;
use App\Http\Controllers\Api\IngestController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Middleware\AdminToken;

// === Публичные endpoints ===

Route::get('/health', fn() => response()->json([
    'status' => 'ok',
    'timestamp' => now()->toIso8601String(),
]));

// Дерево — иерархия для рендеринга
Route::get('/tree', [TreeController::class, 'index']);

// Игроки
Route::get('/players', [PlayerController::class, 'index']);
Route::get('/player/{id}', [PlayerController::class, 'show']);
Route::post('/player', [PlayerController::class, 'store']);

// Рейтинг / Leaderboard
Route::get('/rating', [RatingController::class, 'index']);
Route::get('/leaderboard', [RatingController::class, 'index']); // алиас
Route::get('/rules', [RatingController::class, 'rules']);
Route::get('/activity', [RatingController::class, 'activity']);

// Приём покупок (ingestion)
Route::post('/ingest/website', [IngestController::class, 'website']);
Route::post('/ingest/telegram', [IngestController::class, 'telegram']);

// === Админские endpoints (защищены токеном) ===

Route::middleware(AdminToken::class)->prefix('admin')->group(function () {
    Route::get('/ping', [AdminController::class, 'ping']);
    Route::get('/purchases', [AdminController::class, 'purchases']);
    Route::get('/ingest-events', [AdminController::class, 'ingestEvents']);
    Route::get('/rank-history', [AdminController::class, 'rankHistory']);
    Route::get('/activity-insights', [AdminController::class, 'activityInsights']);
    Route::post('/adjust', [AdminController::class, 'adjust']);
    Route::post('/manual-add', [AdminController::class, 'manualAdd']);
    Route::patch('/rules', [AdminController::class, 'updateRules']);
    Route::patch('/players/{id}', [AdminController::class, 'updatePlayer']);
    Route::delete('/players/{id}', [AdminController::class, 'deletePlayer']);
});
