import type { ProjectionModelSummary, RecommendationReport } from "@fantasy-football/shared";

interface ModelPanelProps {
  model: ProjectionModelSummary;
  report: RecommendationReport;
}

export function ModelPanel({ model, report }: ModelPanelProps) {
  const comparisons = report.starters.flatMap((assignment) =>
    assignment.player.experimentalProjection
      ? [{ slot: assignment.slot, player: assignment.player, model: assignment.player.experimentalProjection }]
      : []
  );

  return (
    <section className="panel model-panel" aria-labelledby="model-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">Experimental</p>
          <h2 id="model-heading">Projection Model</h2>
        </div>
        <span className="status-pill">PPR</span>
      </div>

      <dl className="model-metrics">
        <div><dt>2025 Holdout MAE</dt><dd>{model.modelMae.toFixed(2)}</dd></div>
        <div><dt>Rolling Baseline</dt><dd>{model.baselineMae.toFixed(2)}</dd></div>
        <div><dt>Validation Rows</dt><dd>{model.validationRows.toLocaleString()}</dd></div>
      </dl>

      {comparisons.length > 0 ? (
        <div className="model-comparisons">
          <div className="model-comparison-header">
            <span>Starter</span><span>Provider</span><span>Model</span>
          </div>
          {comparisons.map(({ slot, player, model: projection }) => (
            <div className="model-comparison-row" key={`${slot}-${player.id}`}>
              <span><strong>{player.name}</strong><small>{slot} / {projection.recentGames} recent games</small></span>
              <b>{player.projectedPoints.toFixed(1)}</b>
              <b title={`Approximate range ${projection.low.toFixed(1)} to ${projection.high.toFixed(1)}`}>
                {projection.points.toFixed(1)}
              </b>
            </div>
          ))}
        </div>
      ) : (
        <p className="model-empty">Model forecasts appear after at least three completed games are mapped for a player.</p>
      )}

      <p className="model-disclosure">
        Lineup decisions still use provider projections while same-week provider and model outcomes are collected.
      </p>
    </section>
  );
}
