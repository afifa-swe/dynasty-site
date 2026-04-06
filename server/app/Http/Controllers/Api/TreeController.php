<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RatingService;
use Illuminate\Http\JsonResponse;

class TreeController extends Controller
{
    public function __construct(private RatingService $ratingService) {}

    /**
     * GET /api/tree — иерархия дерева для рендеринга
     */
    public function index(): JsonResponse
    {
        $tree = $this->ratingService->buildTree();
        return response()->json($tree);
    }
}
