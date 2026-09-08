import type { RecommendationReport } from "@fantasy-football/shared";

interface ReportPanelProps {
  report: RecommendationReport;
  statusLabel?: string;
}

export function ReportPanel({ report, statusLabel = "Rule-based" }: ReportPanelProps) {
  return (
    <section className="panel report-panel" aria-labelledby="report-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">Week {report.week}</p>
          <h2 id="report-heading">Lineup Report</h2>
        </div>
        <span className="status-pill">{statusLabel}</span>
      </div>

      <p className="summary">{report.summary}</p>

      {report.projectionSummary && (
        <div className={`projection-summary projection-${report.projectionSummary.method.toLowerCase()}`}>
          <strong>{projectionMethodLabel(report.projectionSummary.method)}</strong>
          <span>{report.projectionSummary.message}</span>
          <small>Source: {report.projectionSummary.sourceLabel}</small>
        </div>
      )}

      <div className="lineup-grid">
        <div className="lineup-table-header" aria-hidden="true">
          <span>Slot</span>
          <span>Starter</span>
          <span>Proj</span>
        </div>
        {report.starters.map((assignment, index) => (
          <article className="lineup-row" key={`${assignment.slot}-${assignment.player.id}-${index}`}>
            <span className="slot">{assignment.slot}</span>
            <div>
              <strong>{assignment.player.name}</strong>
              <span className="starter-meta">{assignment.player.position} / {assignment.player.nflTeam}</span>
              <p>{assignment.reason}</p>
              {assignment.player.projectionBreakdown && assignment.player.projectionBreakdown.length > 0 && (
                <details className="projection-breakdown">
                  <summary>Scoring breakdown</summary>
                  <dl>
                    {assignment.player.projectionBreakdown.map((entry) => (
                      <div key={entry.stat}>
                        <dt>{entry.label} <span>{formatValue(entry.projectedValue)} x {formatValue(entry.pointsPerUnit)}</span></dt>
                        <dd>{entry.fantasyPoints.toFixed(1)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </div>
            <span className="projection">
              {assignment.player.hasProjection === false ? "--" : assignment.player.projectedPoints.toFixed(1)}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function projectionMethodLabel(method: "LEAGUE_RULES" | "PROVIDER_TOTAL" | "MIXED"): string {
  if (method === "LEAGUE_RULES") return "League-scored projections";
  if (method === "MIXED") return "Mixed projection scoring";
  return "Provider projections";
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
