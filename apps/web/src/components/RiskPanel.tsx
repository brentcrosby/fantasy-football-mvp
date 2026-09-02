import type { RecommendationReport } from "@fantasy-football/shared";

interface RiskPanelProps {
  report: RecommendationReport;
}

export function RiskPanel({ report }: RiskPanelProps) {
  return (
    <section className="panel risk-panel" aria-labelledby="risk-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">Roster Review</p>
          <h2 id="risk-heading">Risks and Needs</h2>
        </div>
      </div>

      <div className="note-group">
        <h3>Risk Notes</h3>
        {report.riskNotes.length > 0 ? (
          <ul>
            {report.riskNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : (
          <p>No major bye or injury risks found.</p>
        )}
      </div>

      <div className="note-group">
        <h3>Position Needs</h3>
        {report.positionNeeds.length > 0 ? (
          <ul>
            {report.positionNeeds.map((need) => (
              <li key={need}>{need}</li>
            ))}
          </ul>
        ) : (
          <p>Bench depth looks balanced for the current lineup.</p>
        )}
      </div>
    </section>
  );
}
