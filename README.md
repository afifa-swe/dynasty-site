# Dynasty

Сайт-витрина streetwear бренда **Dynasty** (СПб) с каталогом одежды, предзаказом через Telegram-бот и рейтинговой системой игроков.

## Стек

**Фронтенд**: Vite 5 + React 18 + TypeScript + Tailwind CSS + shadcn/ui

**Бэкенд**: Laravel 13 + PHP 8.3 + Eloquent ORM + PostgreSQL

**Дополнительно**: Telegram-бот, Canvas-визуализация дерева игроков

## Быстрый старт

### Фронтенд

```bash
npm install
npm run dev          # http://localhost:8080
```

### Бэкенд

```bash
cd server
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve --port=4000   # http://localhost:4000
```

Или одной командой:

```bash
cd server && composer run setup
composer run dev
```

### Переменные окружения

**Корень** (`.env`):
```
VITE_API_BASE=http://127.0.0.1:4000
```

**Бэкенд** (`server/.env`):
```
DB_CONNECTION=pgsql
DB_DATABASE=dynasty
TELEGRAM_BOT_TOKEN=             # опционально
ADMIN_API_TOKEN=                # токен для админ-API
```

## Структура

```
dynasty-site/
├── src/                        # React-приложение
│   ├── components/             # Header, Hero, Catalog, About, Footer, ProductCard
│   ├── components/ui/          # shadcn/ui (60+ компонентов)
│   ├── pages/                  # Index, ProductDetail, Rating, NotFound
│   ├── hooks/                  # use-mobile, use-toast
│   └── lib/                    # утилиты
├── public/
│   ├── images/                 # фото товаров и фоны
│   └── tree/                   # Canvas-приложение Dynasty Living Tree
│       ├── index.html
│       ├── tree2d.js           # Canvas-рендеринг дерева
│       ├── players.js          # SVG-оверлей игроков
│       └── style.css
├── server/                     # Laravel API
│   ├── app/Http/Controllers/Api/   # AdminController, IngestController, PlayerController, RatingController, TreeController
│   ├── app/Models/             # Player, Purchase, ActivityLog, ScoringRule, Order...
│   ├── app/Services/           # RatingService, TelegramBotService
│   ├── database/migrations/
│   └── routes/api.php          # все API-маршруты
└── Dynasty-Rating-System-Website-main/  # старая реализация (Express + Prisma)
```

## Основные возможности

- Каталог из 6 товаров (худи, штаны, комплекты) с фото-слайдером
- Предзаказ через Telegram-бот (`@dynastyspbshop_bot`)
- Рейтинговая система с фракциями (Darkness / Light), тирами (Legendary / Noble / Treasure) и достижениями
- Интерактивное дерево игроков на Canvas с pan/zoom
- Админ-API для управления игроками, правилами и аналитикой
- Приём покупок с сайта и из Telegram с автоматическим начислением рейтинга

## API

Все эндпоинты имеют префикс `/api`. Админские эндпоинты защищены заголовком `X-Admin-Token`.

Подробная документация API — в [CLAUDE.md](CLAUDE.md).

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер фронтенда (порт 8080) |
| `npm run build` | Production-сборка в `dist/` |
| `npm run lint` | ESLint |
| `composer run dev` | Dev-сервер бэкенда (concurrent) |
| `composer run test` | PHPUnit тесты |
