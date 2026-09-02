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
6. [ ] Deploy frontend, API, and database.

## Recommendation Rules

- Exclude players who are out, on injured reserve, suspended, or on bye from starter slots.
- Fill required lineup slots before flex.
- Use one-based fantasy lineup positions but store each assignment explicitly.
- FLEX can use RB, WR, or TE.
- Rank players by projected points adjusted for scoring format and availability.
- Surface injury and bye risks even when they do not change the final lineup.

## Later Features

- Sleeper import.
- Real weekly NFL data ingestion.
- AI-generated explanation text from structured recommendation results.
- Prediction model trained against historical fantasy points.
- Trade and waiver analysis.
