# Projection Model

This directory contains a reproducible experiment for predicting an offensive player's next-game PPR fantasy points from recent weekly production and usage.

The trainer downloads completed nflverse weekly player-stat CSVs into the ignored `ml/data/` directory, trains on 2021-2024, and evaluates once on the held-out 2025 season. It compares ridge regression against a simple three-game rolling-average baseline and exports the fitted coefficients, scaling values, residual spread, and validation metrics as a TypeScript artifact used by the API.

The model is deliberately labeled experimental. It does not replace the current provider projection in lineup decisions until the application has collected enough same-week provider observations and outcomes to show that a blend improves on the provider itself.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
npm run ml:train
```

Training data is not committed. The generated model artifact is committed so normal application builds do not require Python or network access.
