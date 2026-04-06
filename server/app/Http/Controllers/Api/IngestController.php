<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IngestEvent;
use App\Services\RatingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class IngestController extends Controller
{
    public function __construct(private RatingService $ratingService) {}

    /**
     * POST /api/ingest/website — приём покупки с сайта
     */
    public function website(Request $request): JsonResponse
    {
        return $this->processIngest($request, 'website');
    }

    /**
     * POST /api/ingest/telegram — приём покупки из Telegram
     */
    public function telegram(Request $request): JsonResponse
    {
        return $this->processIngest($request, 'telegram');
    }

    private function processIngest(Request $request, string $source): JsonResponse
    {
        $data = $request->validate([
            'nickname' => 'required|string|max:100',
            'amount' => 'required|numeric|min:1',
            'order_id' => 'nullable|string|max:200',
            'phone' => 'nullable|string|max:20',
            'items' => 'nullable|array',
            'faction_preference' => 'nullable|in:darkness,light',
            'player_id' => 'nullable|uuid',
        ]);

        try {
            $data['source'] = $source;
            $result = $this->ratingService->processPurchase($data);

            // Записать успешный ingestion
            IngestEvent::create([
                'id' => Str::uuid(),
                'source' => $source,
                'status' => 'success',
                'order_id' => $data['order_id'] ?? null,
                'nickname' => $data['nickname'],
                'phone' => $data['phone'] ?? null,
                'amount' => (int) $data['amount'],
                'items' => $data['items'] ?? [],
                'raw_payload' => $request->all(),
                'player_id' => $result['player']->id ?? null,
            ]);

            $statusCode = $result['status'] === 'duplicate' ? 200 : 201;
            return response()->json($result, $statusCode);

        } catch (\Throwable $e) {
            // Записать ошибку ingestion
            IngestEvent::create([
                'id' => Str::uuid(),
                'source' => $source,
                'status' => 'error',
                'order_id' => $data['order_id'] ?? null,
                'nickname' => $data['nickname'] ?? null,
                'phone' => $data['phone'] ?? null,
                'amount' => isset($data['amount']) ? (int) $data['amount'] : null,
                'raw_payload' => $request->all(),
                'error_message' => $e->getMessage(),
            ]);

            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
