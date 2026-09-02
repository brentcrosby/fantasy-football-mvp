# Fantasy Football Lineup Assistant

Fantasy Football Lineup Assistant is a full-stack MVP for managing a fantasy roster and generating weekly lineup recommendations from roster constraints, scoring format, bye weeks, injury status, and projected points.

## MVP Scope

- Create and review a fantasy team roster.
- Store player position, NFL team, bye week, injury status, and weekly projection data.
- Generate a weekly lineup report with starters, bench players, risk notes, and position needs.
- Keep the first recommendation engine rule-based and explainable before adding any predictive model.

## Tech Stack

- React, TypeScript, and Vite for the frontend.
- Node.js, Express, and TypeScript for the API.
- PostgreSQL with Prisma for team, settings, player, and roster persistence.
- Shared TypeScript package for roster and recommendation types.

## Project Structure

```text
apps/
  api/      Express API and recommendation routes
  web/      React frontend
packages/
  shared/   Shared domain types and lineup engine
docs/
  mvp-plan.md
```

## Getting Started

Prerequisites:

- Node.js 20 or newer.
- Docker Desktop or another Docker Compose-compatible runtime.

Install dependencies:

```bash
npm install
```

Copy the environment variables:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Start PostgreSQL, apply the migration, and seed the stable sample-player catalog:

```bash
docker compose up -d db
npm run db:deploy
npm run db:seed
```

Run the app locally:

```bash
npm run dev
```

The API defaults to `http://localhost:4000`. The Vite frontend will print its local URL in the terminal.

The browser stores only the current fantasy team ID in local storage. The team name, scoring settings, ordered lineup slots, and roster remain authoritative in PostgreSQL.

## Database Commands

Create a development migration after intentionally changing the Prisma schema:

```bash
npm run db:migrate
```

Regenerate Prisma Client and re-run the idempotent seed:

```bash
npm run db:generate
npm run db:seed
```

The initial migration is `20260831210000_init_team_persistence`. Do not reset an existing database to resolve migration conflicts; inspect and reconcile the conflict first.

## Integration Tests

Integration tests use the same PostgreSQL server but require the isolated `test` schema. The test command verifies that `DATABASE_URL` contains exactly `schema=test`, applies migrations, runs the player seed twice to verify idempotency, and then starts the API tests.

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fantasy_football_mvp?schema=test" npm test
```

The cleanup guard refuses to run against the development `public` schema. Tests never reset or truncate the database and only remove integration-test teams from the test schema.

## Current Status

The application uses PostgreSQL-backed players and teams with a deterministic lineup engine. Authentication, external league imports, live NFL data, and saved weekly reports remain later milestones.
