# MVP Plan

## Product Goal

Build a concise full-stack project that proves application development fundamentals: data modeling, API design, frontend workflows, validation, and useful domain logic.

## V1 User Flow

1. User creates an account or signs in.
2. User creates or selects an owned fantasy team.
3. User manages the roster and selects scoring format and NFL week.
4. App generates recommended starters, bench, risk notes, and roster needs.
5. User saves a weekly report and can reopen its immutable snapshot later.

## Implementation Milestones

1. [x] Scaffold React frontend, Express backend, shared domain package, and Prisma schema.
2. [x] Build rule-based recommendation engine.
3. [x] Add manual roster management backed by Postgres.
4. [x] Add auth and user-owned teams.
5. [x] Save weekly recommendation reports.
6. [x] Deploy frontend, API, and database.
7. [x] Sync current weekly player metadata, injuries, bye weeks, and projections.
8. [x] Preview, import, and refresh current-season Sleeper rosters.
9. [x] Persist complete league scoring rules, add component-stat scoring, and label provider-total fallbacks.
10. [x] Scan connected Sleeper leagues and recommend current free-agent upgrades with safe drop candidates.

The live application uses same-origin production serving, startup validation, database health checks, authentication throttling, GitHub CI, a Render Blueprint, and a validated live-data sync with a stable fallback catalog.

## Recommendation Rules

- Exclude players who are out, on injured reserve, suspended, or on bye from starter slots.
- Fill required lineup slots before flex.
- Use one-based fantasy lineup positions but store each assignment explicitly.
- FLEX can use RB, WR, or TE.
- Score projected stat components with the team's rules when they are available.
- Otherwise use the source projection total unchanged and identify that fallback in the report.
- Apply availability and injury risk only to lineup selection, not the displayed projection total.
- Surface injury and bye risks even when they do not change the final lineup.

## Later Features

- Automated projection refresh independent of application restarts.
- Authorized weekly projection feed with passing, rushing, receiving, kicking, and defense stat components.
- AI-generated explanation text from structured recommendation results.
- Prediction model trained against historical fantasy points.
- Trade analysis.
- Transaction history and completed waiver tracking.
