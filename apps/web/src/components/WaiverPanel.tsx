import type { WaiverRecommendationPriority, WaiverReport } from "@fantasy-football/shared";

interface WaiverPanelProps {
  report: WaiverReport | null;
  loading: boolean;
  error: string | null;
  hasSavedTeam: boolean;
  connectedToSleeper: boolean;
  teamDirty: boolean;
  onScan: () => void;
  onOpenTeam: () => void;
}

export function WaiverPanel({
  report,
  loading,
  error,
  hasSavedTeam,
  connectedToSleeper,
  teamDirty,
  onScan,
  onOpenTeam
}: WaiverPanelProps) {
  const canScan = hasSavedTeam && connectedToSleeper && !teamDirty && !loading;

  return (
    <section className="panel waiver-panel" aria-labelledby="waiver-heading">
      <div className="section-header waiver-header">
        <div>
          <p className="eyebrow">League Market</p>
          <h2 id="waiver-heading">Waiver Wire</h2>
        </div>
        <button className="generate-button waiver-scan-button" type="button" disabled={!canScan} onClick={onScan}>
          {loading ? "Scanning..." : report ? "Scan Again" : "Analyze Waivers"}
        </button>
      </div>

      {!hasSavedTeam && (
        <WaiverGate message="Save a team before analyzing league availability." onOpenTeam={onOpenTeam} />
      )}
      {hasSavedTeam && !connectedToSleeper && (
        <WaiverGate message="Waiver availability requires a team imported from Sleeper." onOpenTeam={onOpenTeam} />
      )}
      {hasSavedTeam && connectedToSleeper && teamDirty && (
        <WaiverGate message="Save your roster and scoring changes before analyzing waivers." onOpenTeam={onOpenTeam} />
      )}
      {hasSavedTeam && connectedToSleeper && !teamDirty && !report && !loading && !error && (
        <div className="waiver-empty">
          <strong>Ready to scan</strong>
          <p>Compare your saved roster against every roster in the connected Sleeper league.</p>
        </div>
      )}
      {error && <p className="error waiver-error">{error}</p>}

      {report && (
        <>
          <div className="waiver-summary">
            <p>{report.summary}</p>
            <dl>
              <div>
                <dt>League Owned</dt>
                <dd>{report.rosteredPlayerCount}</dd>
              </div>
              <div>
                <dt>Projected Free Agents</dt>
                <dd>{report.availablePlayerCount}</dd>
              </div>
              <div>
                <dt>Recommendations</dt>
                <dd>{report.recommendations.length}</dd>
              </div>
            </dl>
          </div>

          {report.recommendations.length > 0 ? (
            <div className="waiver-list" aria-label="Waiver recommendations">
              <div className="waiver-table-header" aria-hidden="true">
                <span>Priority</span>
                <span>Transaction</span>
                <span>Impact</span>
              </div>
              {report.recommendations.map((recommendation) => (
                <article className="waiver-row" key={recommendation.player.id}>
                  <span className={`waiver-priority priority-${recommendation.priority.toLowerCase()}`}>
                    {priorityLabel(recommendation.priority)}
                  </span>
                  <div className="waiver-transaction">
                    <div>
                      <span className="transaction-label add-label">Add</span>
                      <strong>{recommendation.player.name}</strong>
                      <small>{recommendation.player.position} / {recommendation.player.nflTeam} / {recommendation.player.projectedPoints.toFixed(1)} proj</small>
                    </div>
                    {recommendation.dropCandidate && (
                      <div>
                        <span className="transaction-label drop-label">Drop</span>
                        <strong>{recommendation.dropCandidate.name}</strong>
                        <small>{recommendation.dropCandidate.position} / {recommendation.dropCandidate.nflTeam} / {recommendation.dropCandidate.projectedPoints.toFixed(1)} proj</small>
                      </div>
                    )}
                  </div>
                  <div className="waiver-impact">
                    {recommendation.lineupGain > 0 && <strong>+{recommendation.lineupGain.toFixed(1)} lineup</strong>}
                    {recommendation.projectionGain !== null && recommendation.projectionGain > 0 && (
                      <span>+{recommendation.projectionGain.toFixed(1)} vs drop</span>
                    )}
                    <p>{recommendation.reason}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="waiver-empty">
              <strong>No clear upgrades</strong>
              <p>The current projected free agents do not improve your starters or flagged depth needs.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function WaiverGate({ message, onOpenTeam }: { message: string; onOpenTeam: () => void }) {
  return (
    <div className="waiver-gate">
      <p>{message}</p>
      <button className="utility-button" type="button" onClick={onOpenTeam}>Open Team Setup</button>
    </div>
  );
}

function priorityLabel(priority: WaiverRecommendationPriority): string {
  if (priority === "STARTER_UPGRADE") return "Starter Upgrade";
  if (priority === "DEPTH_UPGRADE") return "Depth Upgrade";
  return "Depth Need";
}
