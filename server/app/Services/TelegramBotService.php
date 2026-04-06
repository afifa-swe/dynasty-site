<?php

namespace App\Services;

use App\Models\Player;
use App\Models\Order;
use App\Models\ScoringRule;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Сервис Telegram-бота Dynasty
 * Обрабатывает команды пользователей и оформление заказов
 */
class TelegramBotService
{
    private string $token;
    private string $apiUrl;

    /**
     * Каталог товаров (синхронизирован с ProductDetail.tsx)
     */
    private array $products = [
        'black-hoodie' => [
            'title' => 'Dynasty Legacy Hoodie Black',
            'price' => '7890₽',
            'price_num' => 7890,
            'category' => 'Худи',
        ],
        'white-hoodie' => [
            'title' => 'Dynasty Legacy Hoodie Grey',
            'price' => '7890₽',
            'price_num' => 7890,
            'category' => 'Худи',
        ],
        'black-pants' => [
            'title' => 'Dynasty Legacy Pants Black',
            'price' => '6490₽',
            'price_num' => 6490,
            'category' => 'Штаны',
        ],
        'white-pants' => [
            'title' => 'Dynasty Legacy Pants Grey',
            'price' => '6490₽',
            'price_num' => 6490,
            'category' => 'Штаны',
        ],
        'black-set' => [
            'title' => 'Dynasty Legacy Set Black',
            'price' => '12890₽',
            'price_num' => 12890,
            'category' => 'Комплект',
        ],
        'grey-set' => [
            'title' => 'Dynasty Legacy Set Grey',
            'price' => '12890₽',
            'price_num' => 12890,
            'category' => 'Комплект',
        ],
    ];

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
        try {
            $response = Http::timeout($timeout + 5)->post("{$this->apiUrl}/getUpdates", [
                'offset' => $offset,
                'timeout' => $timeout,
                'allowed_updates' => ['message'],
            ]);
            $result = $response->json() ?? [];
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            // Таймаут long-polling — это нормально, новых сообщений просто нет
            return [];
        }

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

        // Если пользователь отправил команду — сбросить состояние заказа
        if (str_starts_with($text, '/')) {
            // /start с deep-link не сбрасываем — он начинает заказ
            $parts = explode(' ', $text, 2);
            $command = strtolower($parts[0]);
            $args = $parts[1] ?? '';

            if ($command === '/cancel') {
                $this->cancelOrder($chatId);
                return;
            }

            // Любая другая команда сбрасывает заказ
            if ($command !== '/start' || empty($args) || !str_contains($args, '_')) {
                Cache::forget("order_state_{$chatId}");
            }

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
            return;
        }

        // Не команда — проверяем, есть ли активный заказ
        $state = Cache::get("order_state_{$chatId}");
        if ($state) {
            $this->handleOrderStep($chatId, $text, $state);
            return;
        }

        // Нет активного заказа и не команда
        $this->sendMessage($chatId,
            "Я не понял. Используйте /help для списка команд."
        );
    }

    // === Оформление заказа ===

    /**
     * Начать оформление заказа (из deep-link)
     */
    private function startOrder(int $chatId, string $firstName, string $productId, string $size): void
    {
        $product = $this->products[$productId] ?? null;

        if (!$product) {
            $this->sendMessage($chatId,
                "Товар не найден. Посмотрите каталог на сайте."
            );
            return;
        }

        // Сохраняем состояние заказа в кэш (30 минут)
        Cache::put("order_state_{$chatId}", [
            'step' => 'waiting_name',
            'product_id' => $productId,
            'product_title' => $product['title'],
            'size' => strtoupper($size),
            'price' => $product['price'],
            'price_num' => $product['price_num'],
        ], now()->addMinutes(30));

        $this->sendMessage($chatId,
            "Привет, {$firstName}!\n\n"
            . "Вы хотите заказать:\n"
            . "<b>{$product['title']}</b>\n"
            . "Размер: <b>" . strtoupper($size) . "</b>\n"
            . "Цена: <b>{$product['price']}</b>\n\n"
            . "Пожалуйста, пришлите ваше <b>имя и фамилию</b>.\n\n"
            . "<i>Для отмены напишите /cancel</i>"
        );
    }

    /**
     * Обработать шаг заказа
     */
    private function handleOrderStep(int $chatId, string $text, array $state): void
    {
        switch ($state['step']) {
            case 'waiting_name':
                if (mb_strlen($text) < 2 || mb_strlen($text) > 100) {
                    $this->sendMessage($chatId, "Пожалуйста, укажите корректное имя и фамилию.");
                    return;
                }
                $state['customer_name'] = $text;
                $state['step'] = 'waiting_phone';
                Cache::put("order_state_{$chatId}", $state, now()->addMinutes(30));

                $this->sendMessage($chatId,
                    "Спасибо, <b>{$text}</b>!\n\n"
                    . "Теперь укажите <b>номер телефона</b> для связи.\n"
                    . "Например: +7 900 123 45 67"
                );
                break;

            case 'waiting_phone':
                $digits = preg_replace('/\D/', '', $text);
                if (strlen($digits) < 10) {
                    $this->sendMessage($chatId,
                        "Пожалуйста, укажите корректный номер телефона.\n"
                        . "Например: +7 900 123 45 67"
                    );
                    return;
                }
                $state['phone'] = $text;
                $state['step'] = 'waiting_address';
                Cache::put("order_state_{$chatId}", $state, now()->addMinutes(30));

                $this->sendMessage($chatId,
                    "Отлично!\n\n"
                    . "Теперь укажите <b>адрес доставки</b>.\n"
                    . "(Город, улица, дом, квартира)"
                );
                break;

            case 'waiting_address':
                if (mb_strlen($text) < 5) {
                    $this->sendMessage($chatId, "Пожалуйста, укажите полный адрес доставки.");
                    return;
                }
                $state['address'] = $text;
                $state['step'] = 'waiting_confirm';
                Cache::put("order_state_{$chatId}", $state, now()->addMinutes(30));

                $this->sendMessage($chatId,
                    "Проверьте ваш заказ:\n\n"
                    . "Товар: <b>{$state['product_title']}</b>\n"
                    . "Размер: <b>{$state['size']}</b>\n"
                    . "Цена: <b>{$state['price']}</b>\n\n"
                    . "Имя: <b>{$state['customer_name']}</b>\n"
                    . "Телефон: <b>{$state['phone']}</b>\n"
                    . "Адрес: <b>{$state['address']}</b>\n\n"
                    . "Всё верно? Напишите <b>Да</b> для подтверждения или <b>Нет</b> для отмены."
                );
                break;

            case 'waiting_confirm':
                $answer = mb_strtolower(trim($text));
                if (in_array($answer, ['да', 'yes', 'ок', 'ok', 'подтверждаю', 'верно'])) {
                    $this->confirmOrder($chatId, $state);
                } elseif (in_array($answer, ['нет', 'no', 'отмена', 'cancel'])) {
                    $this->cancelOrder($chatId);
                } else {
                    $this->sendMessage($chatId,
                        "Напишите <b>Да</b> для подтверждения или <b>Нет</b> для отмены."
                    );
                }
                break;
        }
    }

    /**
     * Подтвердить заказ
     */
    private function confirmOrder(int $chatId, array $state): void
    {
        try {
            // Сохраняем в БД
            $order = Order::create([
                'id' => Str::uuid(),
                'chat_id' => $chatId,
                'product_id' => $state['product_id'],
                'product_title' => $state['product_title'],
                'size' => $state['size'],
                'price' => $state['price'],
                'customer_name' => $state['customer_name'],
                'phone' => $state['phone'],
                'address' => $state['address'],
                'status' => 'confirmed',
            ]);

            // Очищаем состояние
            Cache::forget("order_state_{$chatId}");

            // Сообщение покупателю
            $this->sendMessage($chatId,
                "Заказ оформлен!\n\n"
                . "Товар: <b>{$state['product_title']}</b> ({$state['size']})\n"
                . "Цена: <b>{$state['price']}</b>\n\n"
                . "Мы свяжемся с вами по номеру {$state['phone']} для подтверждения.\n\n"
                . "Спасибо за заказ в <b>Dynasty</b>!"
            );

            // Уведомление админу
            $adminChatId = config('app.telegram_admin_chat_id');
            if ($adminChatId) {
                $this->sendMessage((int) $adminChatId,
                    "Новый заказ\n\n"
                    . "Товар: {$state['product_title']}\n"
                    . "Размер: {$state['size']}\n"
                    . "Цена: {$state['price']}\n\n"
                    . "Покупатель: {$state['customer_name']}\n"
                    . "Телефон: {$state['phone']}\n"
                    . "Адрес: {$state['address']}"
                );
            }

        } catch (\Throwable $e) {
            Log::error("Order creation error: {$e->getMessage()}", [
                'chat_id' => $chatId,
                'state' => $state,
            ]);
            Cache::forget("order_state_{$chatId}");
            $this->sendMessage($chatId,
                "Произошла ошибка при оформлении заказа. Попробуйте позже или напишите @dynastyspbshop."
            );
        }
    }

    /**
     * Отменить заказ
     */
    private function cancelOrder(int $chatId): void
    {
        $state = Cache::get("order_state_{$chatId}");
        Cache::forget("order_state_{$chatId}");

        if ($state) {
            $this->sendMessage($chatId,
                "Заказ отменён.\n\n"
                . "Если хотите заказать снова — выберите товар на сайте."
            );
        } else {
            $this->sendMessage($chatId, "Нет активного заказа для отмены.");
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
            $this->startOrder($chatId, $firstName, $productId, $size);
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
            . "/cancel — Отменить заказ\n"
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
