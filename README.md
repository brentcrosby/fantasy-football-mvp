# Fantasy Football Lineup Assistant

[![CI](https://github.com/brentcrosby/fantasy-football-mvp/actions/workflows/ci.yml/badge.svg)](https://github.com/brentcrosby/fantasy-football-mvp/actions/workflows/ci.yml)

A full-stack fantasy football workspace that brings league rosters, weekly lineup decisions, and AI assistance into one place. Import a Sleeper league, compare teams, review availability, and export league context to your preferred AI assistant.

**[Explore the sample league](https://fantasy-football-lineup-assistant.onrender.com/demo)** · **[Live app](https://fantasy-football-lineup-assistant.onrender.com/)**

The sample league requires no account or AI key. Fictional players and scores run in the browser using the same lineup engine and UI components as the signed-in app. Toggle a quarterback's injury status to see the recommendation change. The hosted service may take a moment to wake after inactivity.

![Sample lineup with starter and bench availability](docs/images/lineup-desktop.png)

## Features

- **Manage a team:** import a Sleeper roster or build one manually; save teams and reopen immutable weekly reports.
- **Review weekly decisions:** automatic lineup recommendations, injury and bye exclusions, position filters, and player explanations.
- **Scout the league:** compare matchups, standings, every roster, availability alerts, and possible trade partners.
- **Find waiver options:** exclude league-owned players and rank candidates by projected lineup improvement.
- **Ask with context:** use the built-in AI assistant or copy/download a league snapshot for another assistant.
- **Inspect the ML experiment:** compare provider points with a historical ridge-regression PPR model, explicitly labeled experimental.

![Sample league context ready to copy or download](docs/images/context-export-desktop.png)

## Engineering

| Layer | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, responsive workspace |
| API | Node.js 22+, Express 5, Zod request validation |
| Persistence | PostgreSQL 16, Prisma migrations, transactions, report snapshots |
| Authentication | scrypt passwords, hashed session tokens, HttpOnly cookies, ownership checks |
| Data | Sleeper; FantasyPros totals and identity mappings via DynastyProcess; nflverse |
| AI | Server-built context, server-only OpenAI key, request limits and failure handling |
| ML | Python, pandas, scikit-learn; exported coefficients evaluated in TypeScript |
| Delivery | GitHub Actions, database and browser tests, Docker, Render |

See [architecture and decisions](docs/architecture.md), [operations](docs/operations.md), and the [model experiment](ml/README.md).

## Run Locally

Requires Node.js **22 or newer**; `.nvmrc` selects 22. To explore the sample league, no database is required:

```bash
npm ci
npm run build --workspace @fantasy-football/shared
npm run dev --workspace @fantasy-football/web
```

Open the URL Vite prints, followed by `/demo`.

For the full application, also install Docker with Compose:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose up -d db
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

The frontend defaults to `http://localhost:5173`; the API uses `http://localhost:4000`. Register a local account and build a manual roster. The seed provides fallback sample data. Run `npm run data:sync` to fetch current regular-season data before importing a Sleeper league. Provider availability and supported league formats determine whether import is available.

The AI assistant is optional. Set `OPENAI_API_KEY` in **apps/api/.env only** to enable paid API requests. The sample league and context export make no AI calls.

## Verify

```bash
npm run typecheck
npm run build
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fantasy_football_mvp?schema=test" npm test
npm exec --workspace @fantasy-football/web -- playwright install chromium
npm run test:e2e --workspace @fantasy-football/web
```

Integration tests require `schema=test`. They apply migrations and seed twice, then exercise authentication, ownership, transactional roster updates, report snapshots, and provider fixtures. Never point tests at production.

Browser checks run the built app at desktop and mobile sizes: navigation, injury substitution, clipboard contents, downloaded text, and absence of API requests. CI runs these against an isolated PostgreSQL service.

## Scope and Limitations

- Recommendations do not submit changes to Sleeper. Import matches an entered public Sleeper username; it does not verify external account ownership.
- Provider projections currently contain finished point totals. Custom scoring is preserved but can only be recalculated when stat components are available.
- League lineups are app recommendations and may differ from submitted starters. Missing catalog players are disclosed.
- Trade ideas describe roster fit, not market value. Activity tracks data changes, not a news feed.
- The committed ML artifact reports MAE **4.6067** vs **4.8428** for a three-game average on **4,325 held-out 2025 player-games**. This is not a measured improvement over FantasyPros or a win-rate claim.
- Registration and session authentication are implemented; email verification and password recovery are not. AI request counters are per-process and reset on restart.
- Exports include timestamps and missing-data notes but do not include free-agent listings or all league matchups.

See [operations](docs/operations.md) for deployment and remaining work, [sources](docs/sources.md) for attribution, and [project notes](docs/resume-notes.md) for resume wording and interview preparation.
