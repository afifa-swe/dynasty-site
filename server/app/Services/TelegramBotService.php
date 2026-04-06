<?php

namespace App\Services;

use App\Models\Player;
use App\Models\ScoringRule;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Сервис Telegram-бота Dynasty
 * Обрабатывает команды пользователей и взаимодействует с БД
 */
class TelegramBotService
{
    private string $token;
    private string $apiUrl;

    public function __construct()
    {
        $this->token = config('app.telegram_bot_token', '');
        $this->apiUrl = "https://api.telegram.org/bot{$this->token}";
    }

    /**
     * Проверить настроен ли бот
     */
    public function isConfigured(): bool
    {
        return !empty($this->token);
    }

    /**
     * Отправить запрос к Telegram API
     */
    public function apiCall(string $method, array $params = []): array
    {
        $response = Http::timeout(30)->post("{$this->apiUrl}/{$method}", $params);
        return $response->json() ?? [];
    }

    /**
     * Отправить текстовое сообщение
     */
    public function sendMessage(int $chatId, string $text, array $extra = []): array
    {
        return $this->apiCall('sendMessage', array_merge([
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => 'HTML',
        ], $extra));
    }

    /**
     * Получить обновления (long-polling)
     */
    public function getUpdates(int $offset = 0, int $timeout = 30): array
    {
        $result = $this->apiCall('getUpdates', [
            'offset' => $offset,
            'timeout' => $timeout,
            'allowed_updates' => ['message'],
        ]);

        return $result['result'] ?? [];
    }

    /**
     * Обработать входящее сообщение
     */
    public function handleMessage(array $message): void
    {
        $chatId = $message['chat']['id'] ?? 0;
        $text = trim($message['text'] ?? '');
        $username = $message['from']['username'] ?? null;
        $firstName = $message['from']['first_name'] ?? 'User';

        if (empty($text) || $chatId === 0) return;

        // Разбираем команду
        $parts = explode(' ', $text, 2);
        $command = strtolower($parts[0]);
        $args = $parts[1] ?? '';

        try {
            match ($command) {
                '/start' => $this->cmdStart($chatId, $firstName, $args),
                '/rating', '/leaderboard', '/top' => $this->cmdRating($chatId),
                '/profile', '/me' => $this->cmdProfile($chatId, $args, $username),
                '/tree' => $this->cmdTree($chatId),
                '/stats' => $this->cmdStats($chatId),
                '/register' => $this->cmdRegister($chatId, $args, $username, $firstName),
                '/rules' => $this->cmdRules($chatId),
                '/help' => $this->cmdHelp($chatId),
                default => $this->cmdUnknown($chatId),
            };
        } catch (\Throwable $e) {
            Log::error("Bot command error: {$e->getMessage()}", [
                'command' => $command,
                'chat_id' => $chatId,
            ]);
            $this->sendMessage($chatId, "Произошла ошибка. Попробуйте позже.");
        }
    }

    // === Команды ===

    /**
     * /start — приветствие + обработка deep-link предзаказа
     */
    private function cmdStart(int $chatId, string $firstName, string $args): void
    {
        if (!empty($args) && str_contains($args, '_')) {
            // Deep-link предзаказ: productId_size
            [$productId, $size] = explode('_', $args, 2);
            $this->sendMessage($chatId,
                "Привет, {$firstName}! \n\n"
                . "Вы хотите оформить предзаказ:\n"
                . "Товар: <b>{$productId}</b>\n"
                . "Размер: <b>{$size}</b>\n\n"
                . "Для оформления напишите администратору @dynastyspbshop"
            );
            return;
        }

        $this->sendMessage($chatId,
            "Добро пожаловать в <b>Dynasty</b>! \n\n"
            . "Я — бот рейтинговой системы Dynasty.\n\n"
            . "Доступные команды:\n"
            . "/rating — Топ игроков\n"
            . "/profile — Ваш профиль\n"
            . "/tree — Ссылка на живое дерево\n"
            . "/stats — Статистика системы\n"
            . "/register [ник] — Регистрация\n"
            . "/rules — Правила начисления\n"
            . "/help — Помощь"
        );
    }

    /**
     * /rating, /top — топ-10 рейтинга
     */
    private function cmdRating(int $chatId): void
    {
        $players = Player::orderByDesc('rating')->limit(10)->get();

        if ($players->isEmpty()) {
            $this->sendMessage($chatId, "Рейтинг пока пуст.");
            return;
        }

        $medals = ['1' => "\xF0\x9F\x91\x91", '2' => "\xF0\x9F\xA5\x88", '3' => "\xF0\x9F\xA5\x89"];
        $lines = ["<b>Top-10 Dynasty Rating</b>\n"];

        foreach ($players as $i => $player) {
            $rank = $i + 1;
            $medal = $medals[(string) $rank] ?? "{$rank}.";
            $tier = strtoupper(substr($player->tier, 0, 1));
            $faction = $player->faction === 'darkness' ? "\xE2\x9A\x94" : "\xE2\x9C\xA8";
            $lines[] = "{$medal} <b>{$player->nickname}</b> — {$player->rating} pts [{$tier}] {$faction}";
        }

        $total = Player::count();
        $lines[] = "\nВсего игроков: {$total}";

        $this->sendMessage($chatId, implode("\n", $lines));
    }

    /**
     * /profile [nickname] — профиль игрока
     */
    private function cmdProfile(int $chatId, string $args, ?string $username): void
    {
        $player = null;

        if (!empty($args)) {
            $player = Player::whereRaw('LOWER(nickname) = ?', [strtolower(trim($args))])->first();
        }

        if (!$player && $username) {
            $player = Player::whereRaw('LOWER(nickname) = ?', [strtolower($username)])->first();
        }

        if (!$player) {
            $this->sendMessage($chatId,
                "Профиль не найден.\n\n"
                . "Используйте: /profile <b>Никнейм</b>\n"
                . "Или зарегистрируйтесь: /register <b>Никнейм</b>"
            );
            return;
        }

        $faction = $player->faction === 'darkness' ? "Darkness \xE2\x9A\x94" : "Light \xE2\x9C\xA8";
        $tier = ucfirst($player->tier);
        $achievements = !empty($player->achievements) ? implode(', ', $player->achievements) : 'Нет';

        $text = "<b>{$player->nickname}</b>\n\n"
            . "Rank: #{$player->rank}\n"
            . "Rating: {$player->rating} pts\n"
            . "Tier: {$tier}\n"
            . "Faction: {$faction}\n"
            . "Purchases: {$player->purchases_count}\n"
            . "Total Volume: {$player->total_volume} RUB\n"
            . "Achievements: {$achievements}";

        $this->sendMessage($chatId, $text);
    }

    /**
     * /tree — ссылка на живое дерево
     */
    private function cmdTree(int $chatId): void
    {
        // URL сайта (можно настроить через .env)
        $siteUrl = config('app.url', 'http://localhost:8080');

        $this->sendMessage($chatId,
            "Dynasty Living Tree\n\n"
            . "Откройте живое дерево Dynasty:\n"
            . "{$siteUrl}/tree/index.html\n\n"
            . "Интерактивная визуализация иерархии всех участников с анимацией."
        );
    }

    /**
     * /stats — общая статистика
     */
    private function cmdStats(int $chatId): void
    {
        $totalPlayers = Player::count();
        $darkCount = Player::where('faction', 'darkness')->count();
        $lightCount = Player::where('faction', 'light')->count();
        $legendaryCount = Player::where('tier', 'legendary')->count();
        $nobleCount = Player::where('tier', 'noble')->count();
        $treasureCount = Player::where('tier', 'treasure')->count();
        $totalRating = Player::sum('rating');
        $avgRating = $totalPlayers > 0 ? (int) round($totalRating / $totalPlayers) : 0;
        $topPlayer = Player::orderByDesc('rating')->first();

        $text = "<b>Dynasty Stats</b>\n\n"
            . "Total Players: {$totalPlayers}\n"
            . "Darkness: {$darkCount} | Light: {$lightCount}\n\n"
            . "Legendary: {$legendaryCount}\n"
            . "Noble: {$nobleCount}\n"
            . "Treasure: {$treasureCount}\n\n"
            . "Average Rating: {$avgRating} pts\n";

        if ($topPlayer) {
            $text .= "Top Player: <b>{$topPlayer->nickname}</b> ({$topPlayer->rating} pts)";
        }

        $this->sendMessage($chatId, $text);
    }

    /**
     * /register [nickname] — регистрация нового игрока
     */
    private function cmdRegister(int $chatId, string $args, ?string $username, string $firstName): void
    {
        $nickname = trim($args);
        if (empty($nickname)) {
            $nickname = $username ?: $firstName;
        }

        // Проверяем, нет ли уже такого игрока
        $existing = Player::whereRaw('LOWER(nickname) = ?', [strtolower($nickname)])->first();
        if ($existing) {
            $this->sendMessage($chatId,
                "Игрок <b>{$nickname}</b> уже зарегистрирован!\n\n"
                . "Rating: {$existing->rating} pts | Rank: #{$existing->rank}\n"
                . "Используйте /profile {$nickname} для просмотра профиля."
            );
            return;
        }

        // Создаём через RatingService для правильного баланса фракций
        $ratingService = app(RatingService::class);
        $player = $ratingService->findOrCreatePlayer([
            'nickname' => $nickname,
        ]);

        $faction = $player->faction === 'darkness' ? "Darkness \xE2\x9A\x94" : "Light \xE2\x9C\xA8";

        $this->sendMessage($chatId,
            "Добро пожаловать в Dynasty!\n\n"
            . "Nickname: <b>{$player->nickname}</b>\n"
            . "Faction: {$faction}\n"
            . "Tier: Treasure\n\n"
            . "Используйте /profile для просмотра профиля."
        );
    }

    /**
     * /rules — правила начисления
     */
    private function cmdRules(int $chatId): void
    {
        $rules = ScoringRule::firstOrCreate(['id' => 1]);

        $text = "<b>Rules</b>\n\n"
            . "Base: {$rules->base_points_per_dollar} pts per RUB\n"
            . "Website Bonus: +{$rules->website_bonus_percent}%\n"
            . "Telegram Bonus: +{$rules->telegram_bonus_percent}%\n"
            . "High Value Threshold: {$rules->high_value_threshold} RUB\n"
            . "High Value Bonus: +{$rules->high_value_bonus_percent}%\n\n"
            . "<b>Tiers:</b>\n"
            . "Legendary — Top 6 per faction\n"
            . "Noble — 7-18 per faction\n"
            . "Treasure — Others";

        $this->sendMessage($chatId, $text);
    }

    /**
     * /help — список команд
     */
    private function cmdHelp(int $chatId): void
    {
        $this->sendMessage($chatId,
            "<b>Dynasty Bot Commands</b>\n\n"
            . "/start — Welcome\n"
            . "/rating — Top-10 leaderboard\n"
            . "/top — Same as /rating\n"
            . "/profile [nick] — Player profile\n"
            . "/me — Your profile\n"
            . "/tree — Dynasty tree link\n"
            . "/stats — Global statistics\n"
            . "/register [nick] — Register\n"
            . "/rules — Scoring rules\n"
            . "/help — This help"
        );
    }

    /**
     * Неизвестная команда
     */
    private function cmdUnknown(int $chatId): void
    {
        $this->sendMessage($chatId,
            "Unknown command. Use /help for available commands."
        );
    }
}
