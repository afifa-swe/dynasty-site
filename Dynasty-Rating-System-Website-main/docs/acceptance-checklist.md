# Acceptance Checklist

## Setup
- Start backend: `cd server` -> `npm install` -> `npm run dev`.
- Run migrations after schema changes: `cd server` -> `npm run prisma:migrate`.
- Set `DATABASE_URL`, `ADMIN_API_TOKEN` (or `ADMIN_JWT_SECRET` + `ADMIN_USERNAME` + `ADMIN_PASSWORD`), `TELEGRAM_*` as needed.
- Start frontend: `npm install` -> `npm run dev` (set `VITE_API_BASE`).

## Core behavior
- Tree updates positions after rating changes without manual refresh.
- Zoom/pan works and profile opens/closes on click.
- Top list matches tree ordering and updates on rating change.

## Automation + integration
- POST a website order to `/ingest/website` and confirm SSE updates tree + top list.
- Trigger Telegram ingest (admin channel message) and confirm updates.
- Verify `/events` stream shows updates in the client without page refresh.
- Resend the same `orderId` and confirm response is `status: duplicate` with no rank change.

## Admin panel
- Adjust rating, edit tier/faction, and confirm changes in tree + top list.
- Update rating rules and verify new purchases use the new rules.
- Purchase Audit shows incoming orders (website + telegram).
- Ingest Events shows errors for bad payloads or parse failures.
- Rank History shows recent rank movement entries.

## Resilience
- Add multiple users and verify layout remains stable.
- Confirm mobile layout is usable and tree remains aligned.
- Run `cd server && npm run seed:large -- 800` and confirm the UI handles the larger member count.
