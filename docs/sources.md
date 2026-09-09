# Data and Asset Sources

| Source | Use |
| --- | --- |
| [Sleeper API](https://docs.sleeper.com/) | Public NFL player catalog, league membership, rosters, scoring rules, standings, and matchups |
| [DynastyProcess data](https://github.com/dynastyprocess/data) | Player ID mappings and FantasyPros-derived weekly point totals |
| [nflverse data releases](https://github.com/nflverse/nflverse-data) | Historical weekly player results for the model experiment and recent model features |
| [Lucide](https://lucide.dev/) | Interface icons through `lucide-react` |

The model artifact records nflverse as its source and CC-BY-4.0 as its license. Historical CSV files are downloaded locally and are not committed. See `ml/train.py` and the artifact's `source` field for the input URL template and attribution.

Availability of a public endpoint is not a grant of unrestricted redistribution rights. Review each upstream provider's current terms before commercial use or redistributing datasets. This repository does not grant rights to upstream data, NFL branding, or third-party assets.

The public demo and repository screenshots use fictional player and manager names, team names, scores, and scenarios. They are generated from `apps/web/src/demo/sampleLeague.ts`, not copied from a real account. Interface screenshots are captured from the production build by the browser tests.
