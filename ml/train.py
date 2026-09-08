#!/usr/bin/env python3
"""Train an explainable next-game PPR projection model on nflverse weekly data."""

from __future__ import annotations

import argparse
import json
import shutil
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import pandas as pd
import certifi
from sklearn.linear_model import RidgeCV
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import StandardScaler

SEASONS = range(2021, 2026)
VALIDATION_SEASON = 2025
POSITIONS = ("QB", "RB", "WR", "TE")
SOURCE_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "stats_player/stats_player_week_{season}.csv"
)
NUMERIC_COLUMNS = (
    "fantasy_points_ppr",
    "attempts",
    "carries",
    "targets",
    "receptions",
    "passing_tds",
    "rushing_tds",
    "receiving_tds",
)
FEATURES = (
    "avg_points_3",
    "avg_points_5",
    "last_points",
    "points_trend",
    "avg_attempts_3",
    "avg_carries_3",
    "avg_targets_3",
    "avg_receptions_3",
    "avg_tds_3",
    "games_in_window",
    "is_qb",
    "is_rb",
    "is_wr",
    "is_te",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("ml/data"))
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("apps/api/src/data/projectionModel.ts"),
    )
    return parser.parse_args()


def load_seasons(data_dir: Path) -> pd.DataFrame:
    data_dir.mkdir(parents=True, exist_ok=True)
    frames = []

    for season in SEASONS:
        path = data_dir / f"stats_player_week_{season}.csv"
        if not path.exists():
            print(f"Downloading {season} nflverse weekly player data...")
            with urlopen(
                SOURCE_URL.format(season=season),
                context=ssl.create_default_context(cafile=certifi.where()),
            ) as response, path.open("wb") as destination:
                shutil.copyfileobj(response, destination)
        frames.append(pd.read_csv(path, low_memory=False))

    frame = pd.concat(frames, ignore_index=True)
    frame = frame[
        (frame["season_type"] == "REG")
        & frame["position"].isin(POSITIONS)
        & frame["player_id"].notna()
    ].copy()
    for column in NUMERIC_COLUMNS:
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0.0)
    return frame.sort_values(["season", "player_id", "week"])


def build_examples(frame: pd.DataFrame) -> pd.DataFrame:
    examples: list[dict[str, float | int | str]] = []

    for (season, player_id), games in frame.groupby(["season", "player_id"], sort=False):
        games = games.sort_values("week")
        for index in range(3, len(games)):
            previous = games.iloc[max(0, index - 5):index]
            last_three = previous.tail(3)
            current = games.iloc[index]
            position = str(current["position"])
            avg_points_3 = float(last_three["fantasy_points_ppr"].mean())
            row: dict[str, float | int | str] = {
                "season": int(season),
                "player_id": str(player_id),
                "week": int(current["week"]),
                "target": float(current["fantasy_points_ppr"]),
                "baseline": avg_points_3,
                "avg_points_3": avg_points_3,
                "avg_points_5": float(previous["fantasy_points_ppr"].mean()),
                "last_points": float(previous.iloc[-1]["fantasy_points_ppr"]),
                "points_trend": float(previous.iloc[-1]["fantasy_points_ppr"] - avg_points_3),
                "avg_attempts_3": float(last_three["attempts"].mean()),
                "avg_carries_3": float(last_three["carries"].mean()),
                "avg_targets_3": float(last_three["targets"].mean()),
                "avg_receptions_3": float(last_three["receptions"].mean()),
                "avg_tds_3": float(
                    last_three[["passing_tds", "rushing_tds", "receiving_tds"]]
                    .sum(axis=1)
                    .mean()
                ),
                "games_in_window": float(len(previous)),
            }
            for candidate in POSITIONS:
                row[f"is_{candidate.lower()}"] = 1.0 if position == candidate else 0.0
            examples.append(row)

    return pd.DataFrame(examples)


def metrics(actual: pd.Series, predicted: np.ndarray | pd.Series) -> dict[str, float]:
    return {
        "mae": round(float(mean_absolute_error(actual, predicted)), 4),
        "rmse": round(float(mean_squared_error(actual, predicted) ** 0.5), 4),
    }


def train(examples: pd.DataFrame) -> dict[str, object]:
    training = examples[examples["season"] < VALIDATION_SEASON]
    validation = examples[examples["season"] == VALIDATION_SEASON]
    scaler = StandardScaler()
    x_train = scaler.fit_transform(training[list(FEATURES)])
    x_validation = scaler.transform(validation[list(FEATURES)])
    model = RidgeCV(alphas=np.logspace(-3, 3, 25)).fit(x_train, training["target"])
    predictions = np.maximum(0.0, model.predict(x_validation))
    residuals = validation["target"].to_numpy() - predictions

    position_metrics = {}
    for position in POSITIONS:
        mask = validation[f"is_{position.lower()}"] == 1
        position_metrics[position] = {
            "rows": int(mask.sum()),
            "model": metrics(validation.loc[mask, "target"], predictions[mask]),
            "baseline": metrics(validation.loc[mask, "target"], validation.loc[mask, "baseline"]),
        }

    return {
        "version": "ridge-next-game-ppr-v1",
        "status": "EXPERIMENTAL",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "trainedSeasons": [min(SEASONS), VALIDATION_SEASON - 1],
        "validationSeason": VALIDATION_SEASON,
        "trainingRows": int(len(training)),
        "validationRows": int(len(validation)),
        "features": list(FEATURES),
        "supportedPositions": list(POSITIONS),
        "alpha": float(model.alpha_),
        "intercept": float(model.intercept_),
        "coefficients": [float(value) for value in model.coef_],
        "means": [float(value) for value in scaler.mean_],
        "scales": [float(value) for value in scaler.scale_],
        "residualStdDev": float(np.std(residuals)),
        "metrics": {
            "model": metrics(validation["target"], predictions),
            "baseline": metrics(validation["target"], validation["baseline"]),
            "byPosition": position_metrics,
        },
        "source": {
            "name": "nflverse weekly player stats",
            "urlTemplate": SOURCE_URL,
            "license": "CC-BY-4.0",
        },
    }


def write_typescript_artifact(output: Path, artifact: dict[str, object]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(artifact, indent=2, sort_keys=True)
    output.write_text(
        "// Generated by ml/train.py. Do not edit by hand.\n"
        f"export const projectionModelArtifact = {payload} as const;\n",
        encoding="utf-8",
    )


def main() -> None:
    args = parse_args()
    frame = load_seasons(args.data_dir)
    examples = build_examples(frame)
    artifact = train(examples)
    write_typescript_artifact(args.output, artifact)
    print(json.dumps(artifact["metrics"], indent=2))
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
