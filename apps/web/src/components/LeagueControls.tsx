import type { ScoringFormat } from "@fantasy-football/shared";

const SCORING_FORMAT_LABELS: Record<ScoringFormat, string> = {
  STANDARD: "Standard",
  HALF_PPR: "Half PPR",
  PPR: "PPR",
  CUSTOM: "Custom"
};

interface LeagueControlsProps {
  week: number;
  scoringFormat: ScoringFormat;
  hasImportedScoringRules: boolean;
  disabled: boolean;
  weekLocked: boolean;
  onWeekChange: (week: number) => void;
  onScoringFormatChange: (scoringFormat: ScoringFormat) => void;
}

export function LeagueControls({
  week,
  scoringFormat,
  hasImportedScoringRules,
  disabled,
  weekLocked,
  onWeekChange,
  onScoringFormatChange
}: LeagueControlsProps) {
  return (
    <section className="panel league-controls" aria-labelledby="league-controls-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">League Rules</p>
          <h2 id="league-controls-heading">Week &amp; Scoring</h2>
        </div>
      </div>

      <div className="control-grid">
        <label className="field" htmlFor="week">
          <span>NFL Week</span>
          <select
            id="week"
            value={week}
            disabled={disabled || weekLocked}
            title={weekLocked ? "The player catalog contains projections for this week." : undefined}
            onChange={(event) => onWeekChange(Number(event.target.value))}
          >
            {Array.from({ length: 18 }, (_value, index) => index + 1).map((weekNumber) => (
              <option key={weekNumber} value={weekNumber}>
                Week {weekNumber}
              </option>
            ))}
          </select>
        </label>

        <label className="field" htmlFor="scoring-format">
          <span>Scoring Format</span>
          <select
            id="scoring-format"
            value={scoringFormat}
            disabled={disabled}
            onChange={(event) => onScoringFormatChange(event.target.value as ScoringFormat)}
          >
            {Object.entries(SCORING_FORMAT_LABELS)
              .filter(([value]) => value !== "CUSTOM" || hasImportedScoringRules)
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="scoring-source">
        {hasImportedScoringRules
          ? "Sleeper scoring rules active."
          : "Preset scoring rules active."}
      </p>
    </section>
  );
}

export function scoringFormatLabel(scoringFormat: ScoringFormat): string {
  return SCORING_FORMAT_LABELS[scoringFormat];
}
