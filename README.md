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
- PostgreSQL with Prisma planned for persistence.
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

Install dependencies:

```bash
npm install
```

Copy environment variables if you want to override local defaults:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Run the app locally:

```bash
npm run dev
```

The API defaults to `http://localhost:4000`. The Vite frontend will print its local URL in the terminal.

## Current Status

This scaffold starts with seed data and a deterministic lineup engine. The next implementation step is replacing seed data with Prisma-backed users, teams, players, and roster records.
