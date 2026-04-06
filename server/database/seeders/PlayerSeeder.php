<?php

namespace Database\Seeders;

use App\Models\Player;
use App\Models\ScoringRule;
use App\Models\ActivityLog;
use App\Services\RatingService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PlayerSeeder extends Seeder
{
    public function run(): void
    {
        // Убедимся что правила существуют
        ScoringRule::firstOrCreate(['id' => 1]);

        $ratingService = app(RatingService::class);

        // === Корневой основатель династии ===
        $founder = Player::create([
            'id' => Str::uuid(),
            'nickname' => 'Александр Волков',
            'rating' => 15200,
            'rank' => 1,
            'faction' => 'darkness',
            'tier' => 'legendary',
            'avatar' => 'https://api.dicebear.com/7.x/adventurer/svg?seed=volkov',
            'join_date' => now()->subMonths(12),
            'purchases_count' => 48,
            'total_volume' => 42000,
            'achievements' => ['First Purchase', 'Top 10', 'Podium Elite', 'Gold Tier', 'High Roller'],
            'last_purchase_at' => now()->subDays(2),
            'last_active' => now()->subHours(3),
        ]);

        // === Второй уровень — «генералы» ===
        $generals = [];

        $generalData = [
            ['nickname' => 'Дмитрий Орлов',   'rating' => 12800, 'faction' => 'darkness', 'purchases' => 38, 'volume' => 35000],
            ['nickname' => 'Елена Сокольская', 'rating' => 11500, 'faction' => 'light',    'purchases' => 35, 'volume' => 30000],
            ['nickname' => 'Максим Черных',    'rating' => 10900, 'faction' => 'darkness', 'purchases' => 32, 'volume' => 28000],
            ['nickname' => 'Анастасия Белова', 'rating' => 10200, 'faction' => 'light',    'purchases' => 30, 'volume' => 26000],
        ];

        foreach ($generalData as $data) {
            $generals[] = Player::create([
                'id' => Str::uuid(),
                'nickname' => $data['nickname'],
                'rating' => $data['rating'],
                'faction' => $data['faction'],
                'tier' => 'legendary',
                'avatar' => 'https://api.dicebear.com/7.x/adventurer/svg?seed=' . urlencode($data['nickname']),
                'join_date' => now()->subMonths(rand(8, 11)),
                'purchases_count' => $data['purchases'],
                'total_volume' => $data['volume'],
                'achievements' => ['First Purchase', 'Top 10', 'Podium Elite', 'Gold Tier', 'High Roller'],
                'parent_id' => $founder->id,
                'last_purchase_at' => now()->subDays(rand(1, 10)),
                'last_active' => now()->subHours(rand(1, 48)),
            ]);
        }

        // === Третий уровень — «офицеры» (noble) ===
        $officers = [];

        $officerData = [
            ['nickname' => 'Кирилл Громов',    'rating' => 9200,  'faction' => 'darkness', 'parent' => 0],
            ['nickname' => 'Виктория Лисова',   'rating' => 8800,  'faction' => 'light',    'parent' => 1],
            ['nickname' => 'Артём Соколов',      'rating' => 8500,  'faction' => 'darkness', 'parent' => 0],
            ['nickname' => 'Мария Ветрова',      'rating' => 8100,  'faction' => 'light',    'parent' => 3],
            ['nickname' => 'Николай Жуков',      'rating' => 7900,  'faction' => 'darkness', 'parent' => 2],
            ['nickname' => 'Ольга Морозова',     'rating' => 7700,  'faction' => 'light',    'parent' => 1],
            ['nickname' => 'Сергей Калашников', 'rating' => 7600,  'faction' => 'darkness', 'parent' => 2],
            ['nickname' => 'Татьяна Иванова',   'rating' => 7500,  'faction' => 'light',    'parent' => 3],
        ];

        foreach ($officerData as $data) {
            $officers[] = Player::create([
                'id' => Str::uuid(),
                'nickname' => $data['nickname'],
                'rating' => $data['rating'],
                'faction' => $data['faction'],
                'tier' => 'noble',
                'avatar' => 'https://api.dicebear.com/7.x/adventurer/svg?seed=' . urlencode($data['nickname']),
                'join_date' => now()->subMonths(rand(4, 8)),
                'purchases_count' => rand(15, 28),
                'total_volume' => rand(12000, 22000),
                'achievements' => ['First Purchase', 'Top 10'],
                'parent_id' => $generals[$data['parent']]->id,
                'last_purchase_at' => now()->subDays(rand(3, 20)),
                'last_active' => now()->subHours(rand(2, 72)),
            ]);
        }

        // === Четвёртый уровень — «рядовые» (treasure) ===
        $soldierData = [
            ['nickname' => 'Андрей Козлов',     'rating' => 6800, 'faction' => 'darkness', 'parent' => 0],
            ['nickname' => 'Ирина Степанова',   'rating' => 6200, 'faction' => 'light',    'parent' => 1],
            ['nickname' => 'Владислав Петров',  'rating' => 5500, 'faction' => 'darkness', 'parent' => 2],
            ['nickname' => 'Алина Кузнецова',   'rating' => 5100, 'faction' => 'light',    'parent' => 3],
            ['nickname' => 'Роман Федоров',     'rating' => 4700, 'faction' => 'darkness', 'parent' => 4],
            ['nickname' => 'Екатерина Попова',  'rating' => 4200, 'faction' => 'light',    'parent' => 5],
            ['nickname' => 'Павел Новиков',     'rating' => 3800, 'faction' => 'darkness', 'parent' => 6],
            ['nickname' => 'Юлия Васильева',    'rating' => 3300, 'faction' => 'light',    'parent' => 7],
            ['nickname' => 'Даниил Смирнов',    'rating' => 2800, 'faction' => 'darkness', 'parent' => 0],
            ['nickname' => 'Полина Захарова',   'rating' => 2200, 'faction' => 'light',    'parent' => 1],
            ['nickname' => 'Тимур Абрамов',     'rating' => 1800, 'faction' => 'darkness', 'parent' => 4],
            ['nickname' => 'Светлана Романова', 'rating' => 1200, 'faction' => 'light',    'parent' => 5],
        ];

        foreach ($soldierData as $data) {
            Player::create([
                'id' => Str::uuid(),
                'nickname' => $data['nickname'],
                'rating' => $data['rating'],
                'faction' => $data['faction'],
                'tier' => 'treasure',
                'avatar' => 'https://api.dicebear.com/7.x/adventurer/svg?seed=' . urlencode($data['nickname']),
                'join_date' => now()->subMonths(rand(1, 5)),
                'purchases_count' => rand(3, 14),
                'total_volume' => rand(2000, 10000),
                'achievements' => ['First Purchase'],
                'parent_id' => $officers[$data['parent']]->id,
                'last_purchase_at' => now()->subDays(rand(5, 30)),
                'last_active' => now()->subDays(rand(1, 14)),
            ]);
        }

        // Пересчитать ранги и тиры
        $ratingService->recalculateRanks();

        // Обновить достижения каждого игрока
        Player::all()->each(fn($p) => $ratingService->updateAchievements($p));

        // Лог активности для красоты
        ActivityLog::create([
            'id' => Str::uuid(),
            'type' => 'manual_add',
            'player_nickname' => 'system',
            'description' => 'Начальные данные загружены (25 игроков)',
            'logged_at' => now(),
        ]);

        $this->command->info('Создано 25 игроков с иерархией дерева');
    }
}
