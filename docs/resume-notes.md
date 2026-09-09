# Resume and Interview Notes

Use only claims you can explain and substantiate. These notes describe repository capabilities; they do not establish which parts you personally wrote without assistance.

## Project Listing

**Fantasy Football Lineup Assistant** | React, TypeScript, Node.js, PostgreSQL, Prisma, OpenAI API

[Live application](https://fantasy-football-lineup-assistant.onrender.com/) | [Sample demo](https://fantasy-football-lineup-assistant.onrender.com/demo) | [GitHub](https://github.com/brentcrosby/fantasy-football-mvp)

Choose two or three bullets that match your own work:

- Built and deployed a full-stack fantasy football app with session authentication, user-owned teams, transactional roster updates, and saved weekly reports.
- Integrated Sleeper league data with a shared lineup engine to compare rosters, matchups, and waiver options; added copyable league snapshots for use with external AI assistants.
- Added a context-aware AI assistant and automated API, PostgreSQL, and browser checks in GitHub Actions.

For an ML-focused application, replace a bullet rather than adding a fourth:

- Evaluated a ridge-regression PPR model on 4,325 held-out 2025 player-games, recording 4.61 MAE versus 4.84 for a three-game-average baseline.

The ML numbers come from the committed artifact, not a new training run during the portfolio-readiness pass. Do not claim the model outperforms FantasyPros or improves fantasy win rate.

## Interview Walkthrough

1. Open the sample demo. Mark Alex Carter out and explain why the shared engine replaces him with a healthy eligible quarterback.
2. Compare the matchup and league rosters. Explain how missing catalog entries and provider totals limit the analysis.
3. Export league context. Explain why timestamps, scoring rules, source limitations, and privacy warnings matter.
4. Walk through a team-update transaction and its atomicity test. Show how ownership is checked before a write.
5. Explain why the assistant receives server-built context and has no ability to execute lineup changes.
6. Describe the model's historical holdout, baseline, and limitations without presenting it as a production prediction breakthrough.

## Before an Interview

- Trace one request from React through Express to Prisma and back.
- Run the tests and intentionally break one assumption to understand the regression it catches.
- Be candid about AI-assisted development. Identify decisions, debugging, and validation you personally performed.
- Explain at least one tradeoff and one next improvement, such as durable AI limits or verified account recovery.
- Do not invent adoption, revenue, uptime, speed, accuracy, or independent-authorship claims.
