# Dynasty Backend (Express + Postgres + SSE)

## Quick start
1) `cp .env.example .env` and set `DATABASE_URL` (e.g., Postgres on localhost or managed service).  
2) Install deps: `npm install`.  
3) Development: `npm run dev` (tsx watch).  
4) Build: `npm run build` and start with `npm start`.
5) Database setup:  
   - Generate tables from schema: `npx prisma migrate dev --name init` (needs DATABASE_URL).  
   - Or apply the pre-baked SQL: `psql "$DATABASE_URL" -f prisma/migrations/0001_init.sql`.
   - Regenerate client after schema edits: `npm run prisma:generate`.

## Endpoints (implemented)
- `GET /health` - heartbeat + DB ping result.
- `GET /events` - SSE stream for live updates (tree/top list/admin log).
- `GET /leaderboard` - ranked users + current rules + recent activity.
- `GET /users/:id` - profile with rating history.
- `GET /rules` - current scoring rules.
- `GET /activity` - recent activity log.
- `POST /ingest/website` - purchase ingestion (site checkout).
- `POST /ingest/telegram` - purchase ingestion (Telegram bot).
- `GET /admin/purchases` - purchase audit feed (admin token).
- `GET /admin/ingest-events` - raw ingest audit + errors (admin token).
- `GET /admin/rank-history` - rank movement history (admin token).
- `POST /admin/login` - exchange username/password for JWT session (admin JWT).
- `POST /admin/manual-add` - add a participant manually.
- `POST /admin/adjust` - manual rating delta.
- `PATCH /admin/rules` - tweak scoring rules.

## Telegram ingest (temporary trigger)
- Set env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` (or `TELEGRAM_ADMIN_CHAT_USERNAME`), `TELEGRAM_POLL_INTERVAL_MS`, `TELEGRAM_FALLBACK_AMOUNT`.
- Bot polls the admin channel and parses order summaries like `Product: ..., Name: ..., Telegram: @handle`. Amounts are taken from the message when present; otherwise the fallback amount is used while payments are offline.
- Parsed orders flow through the same `processPurchase` pipeline as `/ingest/website`, so when checkout goes live you can switch the trigger to "successful payment" by posting the paid order to `/ingest/website` (and disable the Telegram worker if you don't need it).

## Website checkout integration
- Send a JSON POST to `/ingest/website` after payment capture.
- Required fields: `nickname`, `amount`. Optional: `userId`, `phone`, `items`, `factionPreference`.
- Recommended: include `orderId` so duplicate callbacks are ignored.
- Example payload:
  ```json
  {
    "nickname": "DynastyUser",
    "amount": 250,
    "orderId": "order_12345",
    "phone": "+15551234567",
    "items": ["Dynasty Hoodie"],
    "factionPreference": "light"
  }
  ```

## Notes
- SSE events emitted: `purchase_ingested`, `rating_adjusted`, `rules_updated`, `user_added` (payload includes leaderboard and activity slices).
- Admin/auth: set `ADMIN_JWT_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` for JWT sessions. Omit `ADMIN_API_TOKEN` in production to disable the legacy static token.
- Ensure the frontend sets `VITE_API_BASE` to point at this server (e.g., `http://localhost:4000`).
- Client integration notes: see `docs/integration-guide.md`.

## Load testing
- Seed a large dataset for UI testing: `npm run seed:large -- 800`


