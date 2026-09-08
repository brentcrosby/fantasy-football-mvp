# Fantasy Football Lineup Assistant

Fantasy Football Lineup Assistant is a full-stack MVP for managing a fantasy roster and generating weekly lineup recommendations from roster constraints, scoring format, bye weeks, injury status, and projected points.

**Live application:** [fantasy-football-lineup-assistant.onrender.com](https://fantasy-football-lineup-assistant.onrender.com/)

## MVP Scope

- Create and review a fantasy team roster.
- Register, sign in, and manage teams owned by the current account.
- Store player position, NFL team, bye week, injury status, weekly projections, and projection provenance.
- Generate a weekly lineup report with starters, bench players, risk notes, and position needs.
- Save immutable weekly report snapshots and reopen them from team history.
- Scan a connected Sleeper league for unrostered players and rank lineup or depth upgrades.
- Review the current Sleeper matchup, projected position edges, standings, and every league roster.
- Find possible trade conversations based on mutual roster needs and players outside projected starting lineups.
- Compare provider projections with an experimental model trained and evaluated on real historical NFL results.

## Tech Stack

- React, TypeScript, and Vite for the frontend.
- Node.js, Express, and TypeScript for the API.
- PostgreSQL with Prisma for team, settings, player, roster, and report persistence.
- Server-side sessions stored as token hashes with `HttpOnly` browser cookies.
- Shared TypeScript package for roster and recommendation types.
- GitHub Actions for repeatable typecheck, build, and PostgreSQL integration tests.

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

Start PostgreSQL, apply the migration, seed the stable sample-player catalog, and sync the current weekly player data:

```bash
docker compose up -d db
npm run db:deploy
npm run db:seed
npm run data:sync
```

Run the app locally:

```bash
npm run dev
```

The API defaults to `http://localhost:4000`. The Vite frontend will print its local URL in the terminal.

Accounts, sessions, team ownership, scoring settings, ordered lineup slots, rosters, and saved reports remain authoritative in PostgreSQL. Passwords are hashed with Node.js `scrypt`; raw session tokens are never stored in the database.

Saved reports are generated on the server from the persisted team and canonical player records. Each entry preserves the team name, scoring settings, roster, projections, availability, and recommendation result as they existed when saved.

## Live Player Data

The sync pipeline joins three structured sources:

- [Sleeper's read-only NFL API](https://docs.sleeper.com/) for current player IDs, teams, fantasy positions, and injury designations.
- [DynastyProcess player IDs](https://github.com/dynastyprocess/data) to map FantasyPros IDs to Sleeper IDs.
- DynastyProcess's weekly FantasyPros feed for current-week consensus point projections and bye weeks.

Only a fully parsed and validated batch is activated. The API continues serving the stable sample catalog if no successful live sync exists, and production startup can retain the previous catalog if a provider is temporarily unavailable. Syncs are skipped while the stored batch is less than 24 hours old to respect Sleeper's published usage guidance.

Live projections are tied to the reported NFL week. The UI locks lineup generation to that week, and the API rejects mismatched weeks. Existing sample-player roster memberships are reconciled to matching live players without changing immutable saved report snapshots.

Force a local refresh when validating the importer:

```bash
npm --workspace @fantasy-football/api run data:sync -- --force
```

## Scheduled Player Data Refresh

Each successful or failed refresh attempt is recorded in PostgreSQL. The player pool shows whether its last successful sync is current (within 12 hours), stale, or unavailable. A failed refresh never replaces the last validated catalog.

The included GitHub Actions workflow requests a refresh every six hours and can also be run manually. Its refresh step is skipped until both repository secrets are configured, so deploying this code alone does not expose or refresh through the endpoint:

1. Generate a long random value and set it as `DATA_SYNC_CRON_SECRET` in the Render web service environment.
2. Add the same `DATA_SYNC_CRON_SECRET` to the GitHub repository's Actions secrets.
3. Add `PLAYER_DATA_SYNC_URL` to GitHub Actions secrets with `https://fantasy-football-lineup-assistant.onrender.com/api/internal/player-data-sync` (substitute the actual deployed hostname if it changes).

GitHub's scheduled workflows can be delayed, so this is a best-effort portfolio deployment schedule rather than a real-time production job. The protected endpoint accepts only the matching bearer secret and has a daily request limit.

## Sleeper League Import

Authenticated users can enter a Sleeper username, select a current-season NFL league, preview the owned roster, and import it as a normal saved team. Connected teams retain the Sleeper league and roster identity so the same flow can refresh them later without creating duplicates.

The import recognizes Standard, Half PPR, PPR, and custom scoring while preserving Sleeper's complete numeric scoring map. It translates QB, RB, WR, TE, FLEX, K, and DST lineup slots and blocks unsupported starting positions such as superflex and IDP instead of silently changing the league structure. Sleeper's API is read-only, so the application never requests a Sleeper password or modifies the source league.

## Scoring-Aware Projections

The recommendation engine can score projected stat components with the saved league rules, including reception values, passing touchdown values, interceptions, yardage, two-point conversions, fumbles, kicking ranges, and provider-supplied bonus counters. Reports calculated this way include a per-player scoring breakdown.

The current DynastyProcess weekly feed exposes only a finished point total, not passing, rushing, receiving, kicking, or defense projection components. Those totals are therefore kept unchanged and labeled as provider projections in the report. The application does not estimate or reverse-engineer stat lines from a total. Connecting an authorized component-stat feed will activate league-scored projections without changing the recommendation contract or stored Sleeper settings.

## Waiver Recommendations

Sleeper-connected teams can scan every roster in their league to identify players who are actually unrostered. The waiver engine compares those projected free agents against the saved team, prioritizes starting-lineup gains and missing depth, and suggests a same-position drop only when that player is outside the resulting recommended lineup.

The scan is read-only. It does not submit claims or modify the Sleeper league, and manual teams must first be imported from Sleeper so league availability can be verified.

The recommendation strategy treats QB as a required starter but not a routine depth target in one-QB leagues. A quarterback is suggested only when the starting slot is unfilled or a free agent raises projected starter output by at least two points. RB, WR, and TE remain eligible for depth recommendations; K and DST do not receive depth recommendations.

## League Center

The League tab loads the connected Sleeper league's current matchup, live points, standings, managers, team names, and rosters. Each roster is run through the same availability and lineup engine as the user's team, producing comparable projected totals and aggregated QB, RB, WR, TE, FLEX, K, and DST matchup edges.

Sleeper players missing from the current projection catalog are counted and disclosed rather than assigned invented values. The view is read-only and can be refreshed without changing the source league.

The Trade Finder in the League tab looks for players on another team's projected bench who address a starting-lineup weakness or meaningful RB/WR depth need. It only shows an idea when the other roster also has a positional need that one of the user's bench players could address. Missing backup QB or TE depth does not create a recommendation by itself.

Trade results are starting points for a conversation, not fair-value judgments or exact package recommendations. Provider projections drive the roster-fit comparison. In PPR leagues, the experimental model can add a secondary buy-low signal, but it does not override the provider projection or claim to predict rest-of-season value.

League Alerts records meaningful same-week player-data changes for the connected league. It highlights injury-status changes and provider-projection moves of at least two points for the user's roster, the current matchup opponent's projected starters, and other projected league starters. The feed deliberately excludes other managers' bench changes and does not represent article-based news coverage.

## Experimental Projection Model

The repository includes a reproducible ridge-regression training pipeline in `ml/`. It downloads nflverse weekly player stats, trains on the 2021-2024 regular seasons, and evaluates once on the held-out 2025 season. Features use only information available before the predicted game: recent PPR output, attempts, carries, targets, receptions, touchdowns, trend, sample size, and position.

On 4,325 held-out player-games, the checked-in model artifact recorded a 4.6067 MAE and 6.3348 RMSE, compared with 4.8428 MAE and 6.8538 RMSE for a three-game rolling-average baseline. The result supports using the model as an experimental comparison, but it does not establish an advantage over the current FantasyPros-derived provider feed.

The live sync maps Sleeper players to nflverse GSIS IDs, calculates model forecasts when at least three prior games exist, and stores provider/model observations for later outcome comparison. The UI labels these forecasts as experimental PPR values and continues using provider projections for lineup and waiver decisions until collected head-to-head results support a change.

Reproduce the artifact:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
npm run ml:train
```

Historical data comes from the [nflverse data releases](https://github.com/nflverse/nflverse-data) under CC-BY-4.0. Cross-provider GSIS and Sleeper mappings come from the [DynastyProcess data repository](https://github.com/dynastyprocess/data).

Existing teams created before the authentication migration are preserved as unowned legacy records. Authenticated team routes expose only teams owned by the current account.

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

Integration tests use the same PostgreSQL server but require the isolated `test` schema. The test command verifies that `DATABASE_URL` contains exactly `schema=test`, applies migrations, runs the player seed twice to verify idempotency, and then starts the API tests. The suite covers authentication, team and report ownership, request validation, immutable report snapshots, and Sleeper preview/import/refresh behavior against local provider fixtures.

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fantasy_football_mvp?schema=test" npm test
```

The cleanup guard refuses to run against the development `public` schema. Tests never reset or truncate the database and only remove integration-test teams from the test schema.

## Current Status

The application is deployed on Render with secure cookie sessions, user-owned PostgreSQL teams, current weekly NFL player data, Sleeper roster imports with full scoring-rule persistence, a deterministic scoring and lineup engine, matchup and league roster analysis, league-aware waiver recommendations, an evaluated experimental projection model, immutable weekly report history, and automated CI. A licensed component-stat projection feed and transaction tracking remain later features.

Production must use HTTPS so secure session cookies can be sent. The included deployment serves the frontend and API from one origin; configure `WEB_ORIGIN` only if they are hosted separately.

## Render Deployment

The repository includes `render.yaml` for a single same-origin web service and a PostgreSQL database. The Express service serves the built React application, runs pending migrations, seeds the fallback catalog, refreshes live player data when stale, exposes a database-aware `/health` endpoint, and uses secure cookies in production.

To deploy:

1. In Render, create a new Blueprint and connect this GitHub repository.
2. Review the two resources defined by `render.yaml`.
3. Apply the Blueprint and wait for the database and web service to become healthy.
4. Open the generated `onrender.com` URL and verify registration, team saving, recommendation generation, and report history.

The Blueprint selects Render's free web and PostgreSQL plans for initial portfolio testing. Render currently expires free PostgreSQL databases after 30 days and does not provide backups for them. Upgrade the database or use another managed PostgreSQL provider before treating the deployment as durable.

The production server validates `DATABASE_URL`, `PORT`, `NODE_ENV`, and optional `WEB_ORIGIN` values before listening. Registration and login endpoints are limited to 20 attempts per IP every 15 minutes.
