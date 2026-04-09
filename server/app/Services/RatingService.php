<?php

namespace App\Services;

use App\Models\Player;
use App\Models\Purchase;
use App\Models\RatingSnapshot;
use App\Models\ActivityLog;
use App\Models\ScoringRule;
use App\Models\RankHistory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RatingService
{
    // Лимиты слотов на фракцию
    const LEGENDARY_SLOTS = 6;
    const NOBLE_SLOTS = 12;
    const TREASURE_SLOTS = 22;

    /**
     * Рассчитать дельту рейтинга за покупку
     */
    public function calculateDelta(int $amount, string $source, ScoringRule $rules): int
    {
        $base = $amount * $rules->base_points_per_dollar;

        $sourceBonus = $source === 'telegram'
            ? $base * $rules->telegram_bonus_percent / 100
            : $base * $rules->website_bonus_percent / 100;

        $highValueBonus = $amount >= $rules->high_value_threshold
            ? $base * $rules->high_value_bonus_percent / 100
            : 0;

        return (int) round($base + $sourceBonus + $highValueBonus);
    }

    /**
     * Обработать покупку: начислить рейтинг, создать записи
     */
    public function processPurchase(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $rules = ScoringRule::firstOrCreate(['id' => 1]);
            $nickname = $data['nickname'];
            $amount = (int) $data['amount'];
            $source = $data['source'] ?? 'website';
            $orderId = $data['order_id'] ?? null;

            // Дедупликация по order_id
            if ($orderId) {
                $existing = Purchase::where('order_id', $orderId)->first();
                if ($existing) {
                    return ['status' => 'duplicate', 'player' => $existing->player];
                }
            }

            // Найти или создать игрока
            $player = $this->findOrCreatePlayer($data);

            // Рассчитать дельту
            $delta = $this->calculateDelta($amount, $source, $rules);

            $oldRank = $player->rank ?? 0;

            // Обновить рейтинг игрока
            $player->rating += $delta;
            $player->purchases_count += 1;
            $player->total_volume += $amount;
            $player->last_purchase_at = now();
            $player->last_active = now();
            $player->preferred_channel = $source;
            $player->save();

            // Создать покупку
            Purchase::create([
                'id' => Str::uuid(),
                'player_id' => $player->id,
                'amount' => $amount,
                'order_id' => $orderId,
                'source' => $source,
                'items' => $data['items'] ?? [],
                'faction_preference' => $data['faction_preference'] ?? null,
                'rating_delta' => $delta,
            ]);

            // Снимок рейтинга
            RatingSnapshot::create([
                'id' => Str::uuid(),
                'player_id' => $player->id,
                'rating' => $player->rating,
                'source' => $source,
                'amount' => $amount,
                'recorded_at' => now(),
            ]);

            // Лог активности
            ActivityLog::create([
                'id' => Str::uuid(),
                'type' => 'purchase',
                'player_id' => $player->id,
                'player_nickname' => $player->nickname,
                'description' => "Покупка на {$amount}₽ (+{$delta} рейтинга)",
                'source' => $source,
                'amount' => $amount,
                'delta' => $delta,
                'logged_at' => now(),
            ]);

            // Пересчитать ранги и тиры
            $this->recalculateRanks();

            // Обновить достижения
            $player->refresh();
            $this->updateAchievements($player);

            // Записать историю ранга если изменился
            $newRank = $player->rank ?? 0;
            if ($newRank !== $oldRank) {
                RankHistory::create([
                    'id' => Str::uuid(),
                    'player_id' => $player->id,
                    'from_rank' => $oldRank,
                    'to_rank' => $newRank,
                    'rating' => $player->rating,
                    'changed_at' => now(),
                ]);
            }

            return ['status' => 'accepted', 'player' => $player->fresh(), 'delta' => $delta];
        });
    }

    /**
     * Найти игрока по nickname/phone/id или создать нового
     */
    public function findOrCreatePlayer(array $data): Player
    {
        $player = null;

        if (!empty($data['player_id'])) {
            $player = Player::find($data['player_id']);
        }

        if (!$player && !empty($data['phone'])) {
            $phone = $this->normalizePhone($data['phone']);
            $player = Player::where('phone', $phone)->first();
        }

        if (!$player && !empty($data['nickname'])) {
            $player = Player::whereRaw('LOWER(nickname) = ?', [strtolower($data['nickname'])])->first();
        }

        if (!$player) {
            // Авто-баланс фракций
            $darkCount = Player::where('faction', 'darkness')->count();
            $lightCount = Player::where('faction', 'light')->count();
            $faction = $data['faction'] ?? ($darkCount <= $lightCount ? 'darkness' : 'light');

            $nickname = $data['nickname'] ?? 'player-' . Str::random(6);

            // Авто-прикрепление к дереву: новый игрок становится
            // ребёнком наименее загруженного узла (сбалансированное дерево)
            $parentId = $data['parent_id'] ?? $this->findBestParent();

            $player = Player::create([
                'id' => Str::uuid(),
                'nickname' => $nickname,
                'phone' => !empty($data['phone']) ? $this->normalizePhone($data['phone']) : null,
                'faction' => $faction,
                'tier' => 'treasure',
                'avatar' => "https://api.dicebear.com/7.x/adventurer/svg?seed=" . urlencode($nickname),
                'join_date' => now(),
                'parent_id' => $parentId,
            ]);
        }

        return $player;
    }

    /**
     * Пересчитать ранги всех игроков по рейтингу
     */
    public function recalculateRanks(): void
    {
        $players = Player::orderByDesc('rating')->orderBy('created_at')->get();

        foreach ($players as $index => $player) {
            $player->rank = $index + 1;
        }

        // Назначить тиры по слотам
        $this->assignTiers($players);

        // Сохранить всех
        foreach ($players as $player) {
            $player->save();
        }
    }

    /**
     * Назначить тиры по слотам на фракцию
     */
    private function assignTiers($players): void
    {
        if ($players->isEmpty()) return;

        // Первый по рейтингу — legendary (общий победитель)
        $players[0]->tier = 'legendary';

        $darkness = $players->where('faction', 'darkness')->values();
        $light = $players->where('faction', 'light')->values();

        $this->assignFactionTiers($darkness);
        $this->assignFactionTiers($light);
    }

    private function assignFactionTiers($factionPlayers): void
    {
        foreach ($factionPlayers as $i => $player) {
            // Если это общий победитель — уже legendary
            if ($player->rank === 1) continue;

            if ($i < self::LEGENDARY_SLOTS) {
                $player->tier = 'legendary';
            } elseif ($i < self::LEGENDARY_SLOTS + self::NOBLE_SLOTS) {
                $player->tier = 'noble';
            } else {
                $player->tier = 'treasure';
            }
        }
    }

    /**
     * Обновить достижения игрока
     */
    public function updateAchievements(Player $player): void
    {
        $achievements = [];

        if ($player->purchases_count > 0) $achievements[] = 'First Purchase';
        if ($player->rank <= 10 && $player->rank > 0) $achievements[] = 'Top 10';
        if ($player->rank <= 3 && $player->rank > 0) $achievements[] = 'Podium Elite';
        if ($player->rating >= 10000) $achievements[] = 'Gold Tier';
        if ($player->total_volume >= 25000) $achievements[] = 'High Roller';
        if ($player->purchases_count >= 100) $achievements[] = 'Centurion Shopper';

        $player->achievements = $achievements;
        $player->save();
    }

    /**
     * Ручная корректировка рейтинга
     */
    public function adjustRating(string $playerId, int $delta, string $reason): array
    {
        return DB::transaction(function () use ($playerId, $delta, $reason) {
            $player = Player::findOrFail($playerId);
            $oldRank = $player->rank ?? 0;

            $player->rating += $delta;
            if ($player->rating < 0) $player->rating = 0;
            $player->last_active = now();
            $player->save();

            ActivityLog::create([
                'id' => Str::uuid(),
                'type' => 'adjustment',
                'player_id' => $player->id,
                'player_nickname' => $player->nickname,
                'description' => "Корректировка: {$reason} (" . ($delta >= 0 ? '+' : '') . "{$delta})",
                'delta' => $delta,
                'logged_at' => now(),
            ]);

            RatingSnapshot::create([
                'id' => Str::uuid(),
                'player_id' => $player->id,
                'rating' => $player->rating,
                'recorded_at' => now(),
            ]);

            $this->recalculateRanks();
            $player->refresh();
            $this->updateAchievements($player);

            $newRank = $player->rank ?? 0;
            if ($newRank !== $oldRank) {
                RankHistory::create([
                    'id' => Str::uuid(),
                    'player_id' => $player->id,
                    'from_rank' => $oldRank,
                    'to_rank' => $newRank,
                    'rating' => $player->rating,
                    'changed_at' => now(),
                ]);
            }

            return ['status' => 'ok', 'player' => $player->fresh()];
        });
    }

    /**
     * Построить дерево иерархии для API
     */
    public function buildTree(): array
    {
        $players = Player::orderByDesc('rating')->get();
        $byId = $players->keyBy('id');
        $roots = [];
        $childrenMap = [];

        foreach ($players as $player) {
            $childrenMap[$player->id] = [];
        }

        foreach ($players as $player) {
            if ($player->parent_id && $byId->has($player->parent_id)) {
                $childrenMap[$player->parent_id][] = $player->id;
            } else {
                $roots[] = $player->id;
            }
        }

        // Если несколько корней — объединить orphan-узлы под главный корень
        // (игрок с наивысшим рейтингом). Это гарантирует единое дерево.
        if (count($roots) > 1) {
            $mainRoot = $roots[0]; // уже отсортированы по rating DESC
            $orphans = array_slice($roots, 1);
            foreach ($orphans as $orphanId) {
                $childrenMap[$mainRoot][] = $orphanId;
            }
            $roots = [$mainRoot];
        }

        $buildNode = function (string $id) use (&$buildNode, $byId, $childrenMap): array {
            $player = $byId[$id];
            $node = [
                'id' => $player->id,
                'name' => $player->nickname,
                'rank' => $player->rank,
                'rating' => $player->rating,
                'faction' => $player->faction,
                'tier' => $player->tier,
                'avatar_url' => $player->avatar,
                'achievements' => $player->achievements ?? [],
                'purchases' => $player->purchases_count,
                'parent_id' => $player->parent_id,
                'join_date' => $player->join_date?->toIso8601String(),
                'children' => [],
            ];

            foreach ($childrenMap[$id] as $childId) {
                $node['children'][] = $buildNode($childId);
            }

            return $node;
        };

        return array_map($buildNode, $roots);
    }

    /**
     * Найти лучшего родителя для нового игрока — узел с наименьшим
     * числом прямых детей (BFS по уровням, сбалансированное дерево).
     */
    private function findBestParent(): ?string
    {
        $players = Player::select('id', 'parent_id')->get();
        if ($players->isEmpty()) {
            return null;
        }

        // Посчитать кол-во прямых детей каждого узла
        $childrenCount = [];
        foreach ($players as $p) {
            $childrenCount[$p->id] = 0;
        }
        foreach ($players as $p) {
            if ($p->parent_id && isset($childrenCount[$p->parent_id])) {
                $childrenCount[$p->parent_id]++;
            }
        }

        // Вернуть игрока с наименьшим числом детей (предпочтение игрокам
        // с более высоким рейтингом при равенстве — ORDER BY rating DESC)
        $bestId = null;
        $bestCount = PHP_INT_MAX;
        $playersWithRating = Player::select('id', 'rating')->orderByDesc('rating')->get();
        foreach ($playersWithRating as $p) {
            $cnt = $childrenCount[$p->id] ?? 0;
            if ($cnt < $bestCount) {
                $bestCount = $cnt;
                $bestId = $p->id;
            }
        }

        return $bestId;
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone);
        if (strlen($digits) === 11 && $digits[0] === '8') {
            $digits = '7' . substr($digits, 1);
        }
        return '+' . $digits;
    }
}
