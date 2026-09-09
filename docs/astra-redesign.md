# Astra workspace experiment

Branch: `feature/astra-fantasy-redesign`, based on `origin/main` at `3c17be2`.
The earlier workspace-workflow experiment and the original checkout are unchanged.

## Product references

- [Sleeper fantasy football](https://sleeper.com/fantasy-football): persistent destinations, compact matchup totals, and position-aligned player rows. Reviewed its published mobile matchup screenshot.
- [Sleeper points breakdown](https://support.sleeper.com/en/articles/4126744-how-can-i-see-my-player-s-points-breakdown): weekly context and on-demand player details.
- [ESPN setting your lineup](https://support.espn.com/hc/en-us/articles/360000093672-Setting-Your-Lineup): My Team as the home for starters and bench.
- [Yahoo player matchup directory](https://football.fantasysports.yahoo.com/f1/playermatchups): dense player identity, position filtering, and comparable projection columns. Reviewed the actual directory in the browser.

These informed the information hierarchy, not a copy of another service's branding.

## Decisions

- Persistent desktop sidebar and mobile bottom navigation: My Team, Matchup, Players, League, Assistant. Settings is a separate destination.
- My Team shows the actual selected roster as recommended starters and bench. Recommendations load automatically and update after roster/scoring changes. Refresh is an explicit retry, not a prerequisite.
- Keep player discovery, waivers, standings, trade ideas, league activity, and settings out of the primary roster view.
- Clearly label recommendations and projections; matchup rows are not claimed to be managers' submitted Sleeper starters.
- Save only changes to the app's roster/settings. The persistent draft bar supports Save and Discard. Do not write to Sleeper.
- Preserve optional historical lineup snapshots under Settings instead of requiring report generation and saving for normal use.
- Surface injury and bye-week flags, not generic backup-position nags.
- Keep experimental model comparisons collapsed. Preserve the existing assistant API and avoid paid calls during visual QA.
- Use NFL team logos with text fallbacks. External logos use ESPN's public CDN and reveal no account identifiers.

## Verification

- Frontend tests cover automatic loading, identical-input deduplication, rapid edits, stale cross-team responses, explicit retry after errors, empty/disabled input, discard without writes, and save-time edit locking.
- The existing 62 backend tests pass against the guarded local `schema=test` database.
- Production build and TypeScript checks pass.
- Browser verification uses the actual local account and connected Sleeper roster. Temporary unsaved roster edits were discarded; no saved roster changes or AI requests were made.
- Desktop and mobile checks cover primary navigation, roster filters, expanded player details, automatic recommendations after a draft edit, discard, search, and image loading. No page-wide horizontal overflow at 320px after fixes.

## Local preview

Run the API with `PORT=4002`, `WEB_ORIGIN=http://localhost:5175`, and the existing local API environment configuration. Run Vite with `VITE_API_BASE_URL=http://localhost:4002` on port 5175. Do not commit environment files.

This experiment does not modify backend contracts, models, provider data, or production deployment configuration. Stale source data remains visibly marked; a redesigned interface does not make the underlying feed current.
