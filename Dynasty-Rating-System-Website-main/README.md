
# Dynasty Rating System Website

Frontend (Vite/React) + backend (Express/Prisma/Postgres + SSE) for the Dynasty rating/tree experience.

## Frontend
1) `npm install`
2) Copy `.env.example` to `.env` and set `VITE_API_BASE` (e.g., `http://localhost:4000`).
3) `npm run dev` to start the Vite dev server.

## Backend
Located in `server/` (see `server/README.md` for full details).
1) `cd server`
2) `cp .env.example .env` and set `DATABASE_URL` (Postgres) and `PORT` if not 4000.
3) Install deps: `npm install`
4) Create tables: `npx prisma migrate dev --name init` (or apply `prisma/migrations/0001_init.sql`).
5) `npm run dev` to start the API + SSE broker.

With both running, the frontend will hydrate from `/leaderboard` and live updates via `/events`.
  

