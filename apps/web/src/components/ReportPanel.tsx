import type { RecommendationReport } from "@fantasy-football/shared";

interface ReportPanelProps {
  report: RecommendationReport;
}

export function ReportPanel({ report }: ReportPanelProps) {
  return (
    <section className="panel report-panel" aria-labelledby="report-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">Week {report.week}</p>
          <h2 id="report-heading">Lineup Report</h2>
        </div>
        <span className="status-pill">Rule-based</span>
      </div>

      <p className="summary">{report.summary}</p>

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
            </div>
            <span className="projection">{assignment.player.projectedPoints.toFixed(1)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
