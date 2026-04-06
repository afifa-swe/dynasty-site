<?php

namespace App\Console\Commands;

use App\Services\TelegramBotService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Artisan-команда для запуска Telegram-бота в режиме long-polling
 * Использование: php artisan bot:poll
 */
class TelegramBotPoll extends Command
{
    protected $signature = 'bot:poll {--timeout=30 : Таймаут long-polling в секундах}';
    protected $description = 'Запустить Telegram-бота Dynasty в режиме long-polling';

    public function handle(TelegramBotService $bot): int
    {
        if (!$bot->isConfigured()) {
            $this->error('TELEGRAM_BOT_TOKEN не настроен в .env');
            $this->info('Добавьте TELEGRAM_BOT_TOKEN в server/.env и перезапустите.');
            return self::FAILURE;
        }

        $timeout = (int) $this->option('timeout');
        $this->info("Dynasty Telegram Bot started (long-polling, timeout={$timeout}s)");
        $this->info('Press Ctrl+C to stop...');

        // Проверяем подключение
        $me = $bot->apiCall('getMe');
        if (empty($me['result'])) {
            $this->error('Failed to connect to Telegram API. Check your token.');
            return self::FAILURE;
        }

        $botName = $me['result']['username'] ?? 'unknown';
        $this->info("Connected as @{$botName}");

        $offset = 0;

        // Graceful shutdown
        $running = true;
        if (function_exists('pcntl_signal')) {
            pcntl_signal(SIGINT, function () use (&$running) {
                $running = false;
            });
            pcntl_signal(SIGTERM, function () use (&$running) {
                $running = false;
            });
        }

        while ($running) {
            if (function_exists('pcntl_signal_dispatch')) {
                pcntl_signal_dispatch();
            }

            try {
                $updates = $bot->getUpdates($offset, $timeout);

                foreach ($updates as $update) {
                    $updateId = $update['update_id'] ?? 0;
                    $offset = $updateId + 1;

                    if (isset($update['message'])) {
                        $msg = $update['message'];
                        $from = $msg['from']['username'] ?? $msg['from']['first_name'] ?? '?';
                        $text = $msg['text'] ?? '[no text]';
                        $this->line("<fg=gray>" . date('H:i:s') . "</> <fg=cyan>{$from}</> {$text}");

                        $bot->handleMessage($msg);
                    }
                }
            } catch (\Throwable $e) {
                $this->error("Error: {$e->getMessage()}");
                Log::error("Bot polling error: {$e->getMessage()}");
                // Ждём перед повторной попыткой
                sleep(3);
            }
        }

        $this->info('Bot stopped gracefully.');
        return self::SUCCESS;
    }
}
