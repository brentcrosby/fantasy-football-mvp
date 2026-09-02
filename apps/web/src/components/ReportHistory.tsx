import type { SavedWeeklyReport } from "@fantasy-football/shared";

interface ReportHistoryProps {
  reports: SavedWeeklyReport[];
  loading: boolean;
  error: string | null;
  selectedReportId: string | null;
  currentReportAvailable: boolean;
  onSelect: (report: SavedWeeklyReport) => void;
  onShowCurrent: () => void;
}

export function ReportHistory({
  reports,
  loading,
  error,
  selectedReportId,
  currentReportAvailable,
  onSelect,
  onShowCurrent
}: ReportHistoryProps) {
  return (
    <section className="panel history-panel" aria-labelledby="history-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">Archive</p>
          <h2 id="history-heading">Saved Reports</h2>
        </div>
        <span className="status-pill">{reports.length}</span>
      </div>

      {selectedReportId && currentReportAvailable && (
        <div className="history-current-row">
          <span>Viewing a saved snapshot</span>
          <button className="history-button" type="button" onClick={onShowCurrent}>Current</button>
        </div>
      )}

      {loading ? (
        <p className="history-message">Loading saved reports...</p>
      ) : error ? (
        <p className="history-message error">{error}</p>
      ) : reports.length === 0 ? (
        <p className="history-message">No saved reports for this team yet.</p>
      ) : (
        <ul className="history-list">
          {reports.map((report) => (
            <li className={selectedReportId === report.id ? "is-active" : ""} key={report.id}>
              <div>
                <strong>Week {report.week}</strong>
                <span>{formatSavedAt(report.createdAt)}</span>
              </div>
              <button
                className="history-button"
                type="button"
                aria-label={`View saved Week ${report.week} report from ${formatSavedAt(report.createdAt)}`}
                aria-pressed={selectedReportId === report.id}
                onClick={() => onSelect(report)}
              >
                View
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatSavedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
