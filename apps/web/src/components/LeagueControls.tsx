import type { ScoringFormat } from "@fantasy-football/shared";

const SCORING_FORMAT_LABELS: Record<ScoringFormat, string> = {
  STANDARD: "Standard",
  HALF_PPR: "Half PPR",
  PPR: "PPR"
};

interface LeagueControlsProps {
  week: number;
  scoringFormat: ScoringFormat;
  disabled: boolean;
  onWeekChange: (week: number) => void;
  onScoringFormatChange: (scoringFormat: ScoringFormat) => void;
}

export function LeagueControls({ week, scoringFormat, disabled, onWeekChange, onScoringFormatChange }: LeagueControlsProps) {
  return (
    <section className="panel league-controls" aria-labelledby="league-controls-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">League Setup</p>
          <h2 id="league-controls-heading">Controls</h2>
        </div>
      </div>

      <div className="control-grid">
        <label className="field" htmlFor="week">
          <span>NFL Week</span>
          <select id="week" value={week} disabled={disabled} onChange={(event) => onWeekChange(Number(event.target.value))}>
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
            {Object.entries(SCORING_FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export function scoringFormatLabel(scoringFormat: ScoringFormat): string {
  return SCORING_FORMAT_LABELS[scoringFormat];
}
