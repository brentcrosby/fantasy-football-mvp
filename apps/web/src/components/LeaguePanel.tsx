import { useEffect, useState } from "react";
import type {
  LeagueOverview,
  LeagueAlertReport,
  LeagueAlertScope,
  LeagueAlertType,
  LeagueTeam,
  ScoringFormat,
  ScoringRules,
  TradeConsiderationReport,
  TradeConsiderationRole
} from "@fantasy-football/shared";

import { LeagueContextExport } from "./LeagueContextExport";

interface LeaguePanelProps {
  overview: LeagueOverview | null;
  loading: boolean;
  error: string | null;
  hasSavedTeam: boolean;
  connectedToSleeper: boolean;
  teamDirty: boolean;
  scoringFormat: ScoringFormat;
  scoringRules: ScoringRules | null;
  lineupSlots: string[];
  projectionUpdatedAt: string | null;
  onRefresh: () => void;
  onOpenTeam: () => void;
}

export function LeaguePanel({
  overview,
  loading,
  error,
  hasSavedTeam,
  connectedToSleeper,
  teamDirty,
  scoringFormat,
  scoringRules,
  lineupSlots,
  projectionUpdatedAt,
  onRefresh,
  onOpenTeam
}: LeaguePanelProps) {
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);
  const [leagueView, setLeagueView] = useState<"OVERVIEW" | "TRADES" | "ALERTS" | "EXPORT">("OVERVIEW");

  useEffect(() => {
    if (!overview) {
      setSelectedRosterId(null);
      return;
    }

    const opponentId = overview.matchup?.opponentRosterId;
    setSelectedRosterId((current) =>
      current && overview.teams.some((team) => team.rosterId === current)
        ? current
        : opponentId ?? overview.teams.find((team) => !team.isUserTeam)?.rosterId ?? overview.userRosterId
    );
  }, [overview]);

  const selectedTeam = overview?.teams.find((team) => team.rosterId === selectedRosterId) ?? null;
  const userTeam = overview?.teams.find((team) => team.isUserTeam) ?? null;
  const alertReport = overview
    ? overview.alertReport ?? {
        week: overview.week,
        alerts: [],
        summary: `No material rostered-player changes have been captured for Week ${overview.week} yet.`
      }
    : null;
  const canRefresh = hasSavedTeam && connectedToSleeper && !teamDirty && !loading;

  return (
    <section className="league-dashboard" aria-labelledby="league-heading">
      <div className="section-header league-page-header">
        <div>
          <p className="eyebrow">{overview?.league.status === "sample_data" ? "Sample League" : "Sleeper League"}</p>
          <h2 id="league-heading">{overview?.league.name ?? "League Center"}</h2>
          {overview && <p className="league-source">Week {overview.week} projections from {overview.projectionSource}</p>}
        </div>
        <button className="utility-button" type="button" disabled={!canRefresh} onClick={onRefresh}>
          {loading ? "Refreshing..." : overview ? "Refresh League" : "Load League"}
        </button>
      </div>

      {!hasSavedTeam && <LeagueGate message="Save a team before loading league details." onOpenTeam={onOpenTeam} />}
      {hasSavedTeam && !connectedToSleeper && (
        <LeagueGate message="Matchups and standings require a team imported from Sleeper." onOpenTeam={onOpenTeam} />
      )}
      {hasSavedTeam && connectedToSleeper && teamDirty && (
        <LeagueGate message="Save your team changes before loading league details." onOpenTeam={onOpenTeam} />
      )}
      {error && <p className="error league-error">{error}</p>}
      {loading && !overview && <p className="state-message league-loading">Loading the league...</p>}

      {overview && userTeam && (
        <>
          <div className="league-view-toggle" role="tablist" aria-label="League views">
            <button
              type="button"
              role="tab"
              aria-selected={leagueView === "OVERVIEW"}
              className={leagueView === "OVERVIEW" ? "is-active" : undefined}
              onClick={() => setLeagueView("OVERVIEW")}
            >
              Standings
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leagueView === "TRADES"}
              className={leagueView === "TRADES" ? "is-active" : undefined}
              onClick={() => setLeagueView("TRADES")}
            >
              Trade ideas
              <span>{overview.tradeReport.considerations.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leagueView === "ALERTS"}
              className={leagueView === "ALERTS" ? "is-active" : undefined}
              onClick={() => setLeagueView("ALERTS")}
            >
              Activity
              <span>{alertReport?.alerts.length ?? 0}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leagueView === "EXPORT"}
              className={leagueView === "EXPORT" ? "is-active" : undefined}
              onClick={() => setLeagueView("EXPORT")}
            >
              Context export
            </button>
          </div>

          {leagueView === "OVERVIEW" ? (
            <>

              <div className="league-grid">
                <section className="panel standings-panel" aria-labelledby="standings-heading">
                  <div className="section-header compact-header">
                    <div>
                      <p className="eyebrow">League Table</p>
                      <h3 id="standings-heading">Standings</h3>
                    </div>
                  </div>
                  <div className="standings-table" role="group" aria-label="League standings">
                    <div className="standings-row standings-header" aria-hidden="true">
                      <span>Rank</span><span>Team</span><span>Record</span><span>PF</span>
                    </div>
                    {overview.teams.map((team, index) => (
                      <button
                        className={`standings-row${team.rosterId === selectedRosterId ? " is-selected" : ""}`}
                        type="button"
                        aria-pressed={team.rosterId === selectedRosterId}
                        key={team.rosterId}
                        onClick={() => setSelectedRosterId(team.rosterId)}
                      >
                        <span>{index + 1}</span>
                        <span><strong>{team.teamName}</strong><small>{team.isUserTeam ? "Your team" : team.ownerName}</small></span>
                        <span>{recordLabel(team)}</span>
                        <span>{team.pointsFor.toFixed(1)}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <TeamRoster team={selectedTeam} />
              </div>
            </>
          ) : leagueView === "TRADES" ? (
            <TradeFinder report={overview.tradeReport} />
          ) : leagueView === "ALERTS" ? (
            <LeagueAlerts report={alertReport!} />
          ) : teamDirty || loading || error ? (
            <p role="status" className="state-message">{teamDirty ? "Save or discard team changes before exporting." : loading ? "Refreshing league context..." : "Refresh the league successfully before exporting."}</p>
          ) : (
            <LeagueContextExport
              overview={overview}
              scoringFormat={scoringFormat}
              scoringRules={scoringRules}
              lineupSlots={lineupSlots}
              projectionUpdatedAt={projectionUpdatedAt}
            />
          )}
        </>
      )}
    </section>
  );
}

function LeagueAlerts({ report }: { report: LeagueAlertReport }) {
  return (
    <section className="league-alerts" aria-labelledby="league-alerts-heading">
      <div className="trade-finder-summary">
        <div>
          <p className="eyebrow">Roster Watch</p>
          <h3 id="league-alerts-heading">League Alerts</h3>
          <p>{report.summary}</p>
        </div>
        <span className="status-pill">Week {report.week}</span>
      </div>

      {report.alerts.length > 0 ? (
        <div className="league-alert-list">
          {report.alerts.map((alert) => (
            <article className={`league-alert type-${alert.type.toLowerCase()}`} key={alert.id}>
              <div className="league-alert-header">
                <span className={`alert-scope scope-${alert.scope.toLowerCase()}`}>{alertScopeLabel(alert.scope)}</span>
                <div>
                  <strong>{alert.player.name}</strong>
                  <small>{alert.player.position} / {alert.player.nflTeam} / {alert.team.teamName}</small>
                </div>
                <time dateTime={alert.createdAt}>{alertTimeLabel(alert.createdAt)}</time>
              </div>
              <p>{alert.summary}</p>
              <div className="league-alert-meta">
                <span>{alertTypeLabel(alert.type)}</span>
                {alert.type === "INJURY_STATUS" ? (
                  <b>{formatInjuryStatus(alert.injuryStatus)}</b>
                ) : (
                  <b>{(alert.previousProjectedPoints ?? 0).toFixed(1)} to {(alert.projectedPoints ?? 0).toFixed(1)} proj</b>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel trade-empty">
          <strong>No league alerts yet</strong>
          <p>Alerts appear after a later Week {report.week} player-data sync detects a meaningful status or projection change.</p>
        </div>
      )}

      <p className="trade-disclosure">Alerts track provider status and projection changes for your roster and projected starters around the league. They are not article-based news coverage.</p>
    </section>
  );
}

function TradeFinder({ report }: { report: TradeConsiderationReport }) {
  return (
    <section className="trade-finder" aria-labelledby="trade-finder-heading">
      <div className="trade-finder-summary">
        <div>
          <p className="eyebrow">Roster Fit</p>
          <h3 id="trade-finder-heading">Trades to Consider</h3>
          <p>{report.summary}</p>
        </div>
        <span className="status-pill">Week {report.week}</span>
      </div>

      {report.considerations.length > 0 ? (
        <div className="trade-list">
          {report.considerations.map((consideration) => (
            <article className="trade-card" key={`${consideration.targetTeam.rosterId}-${consideration.targetPlayer.id}`}>
              <div className="trade-card-heading">
                <span className={`trade-role role-${consideration.role.toLowerCase()}`}>
                  {tradeRoleLabel(consideration.role)}
                </span>
                <div>
                  <strong>{consideration.targetPlayer.name}</strong>
                  <small>
                    {consideration.targetPlayer.position} / {consideration.targetPlayer.nflTeam} / {consideration.targetTeam.teamName}
                  </small>
                </div>
                <b>{consideration.targetPlayer.projectedPoints.toFixed(1)} proj</b>
              </div>

              <dl className="trade-signals">
                <div>
                  <dt>Manager</dt>
                  <dd>{consideration.targetTeam.ownerName}</dd>
                </div>
                <div>
                  <dt>Projection Edge</dt>
                  <dd>{consideration.providerUpgrade === null ? "Fit only" : `+${consideration.providerUpgrade.toFixed(1)}`}</dd>
                </div>
                <div>
                  <dt>ML Signal</dt>
                  <dd>{consideration.modelGap === null ? "Not used" : `${consideration.modelGap >= 0 ? "+" : ""}${consideration.modelGap.toFixed(1)}`}</dd>
                </div>
              </dl>

              <div className="trade-card-body">
                <div>
                  <h4>Why it fits</h4>
                  <ul>
                    {consideration.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Possible conversation pieces</h4>
                  <div className="trade-piece-list">
                    {consideration.possibleTradePieces.map((player) => (
                      <span key={player.id}>
                        <strong>{player.name}</strong>
                        <small>{player.position} / {player.projectedPoints.toFixed(1)} proj</small>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel trade-empty">
          <strong>No clear trade conversations</strong>
          <p>Current projected benches do not show an obvious need-for-need fit between your team and another manager.</p>
        </div>
      )}

      <p className="trade-disclosure">
        These are discussion targets, not fair-value claims. {report.modelUsed
          ? "The PPR model is used only as a secondary signal."
          : "The PPR model is not applied to this scoring format."}
      </p>
    </section>
  );
}

function tradeRoleLabel(role: TradeConsiderationRole): string {
  if (role === "STARTER_UPGRADE") return "Starter Upgrade";
  if (role === "MODEL_BUY_LOW") return "Model Buy-Low";
  return "Depth Target";
}

function alertScopeLabel(scope: LeagueAlertScope): string {
  if (scope === "YOUR_ROSTER") return "Your Roster";
  if (scope === "MATCHUP_OPPONENT") return "Matchup Opponent";
  return "League Starter";
}

function alertTypeLabel(type: LeagueAlertType): string {
  if (type === "INJURY_STATUS") return "Status Update";
  return type === "PROJECTION_FALL" ? "Projection Down" : "Projection Up";
}

function formatInjuryStatus(status: string | null): string {
  return (status ?? "HEALTHY").replace("_", " ");
}

function alertTimeLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recent" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TeamRoster({ team }: { team: LeagueTeam | null }) {
  return (
    <section className="panel opponent-roster" aria-labelledby="roster-scout-heading">
      <div className="section-header compact-header">
        <div>
          <p className="eyebrow">Team Scout</p>
          <h3 id="roster-scout-heading">{team?.teamName ?? "Select a team"}</h3>
          {team && <p>{team.ownerName} / {recordLabel(team)}</p>}
        </div>
        {team && <strong className="team-projection">{team.projectedPoints.toFixed(1)} proj</strong>}
      </div>

      {team && (
        <div className="scout-roster-list">
          {team.starters.map((assignment) => (
            <div className="scout-player" key={`${assignment.slot}-${assignment.player.id}`}>
              <span className="slot-badge">{assignment.slot}</span>
              <span><strong>{assignment.player.name}</strong><small>{assignment.player.nflTeam}</small></span>
              <b>{assignment.player.projectedPoints.toFixed(1)}</b>
            </div>
          ))}
          {team.bench.length > 0 && <div className="scout-divider">Bench</div>}
          {team.bench.map((player) => (
            <div className="scout-player is-bench" key={player.id}>
              <span className="slot-badge">{player.position}</span>
              <span><strong>{player.name}</strong><small>{player.nflTeam}</small></span>
              <b>{player.projectedPoints.toFixed(1)}</b>
            </div>
          ))}
          {team.unmatchedPlayerCount > 0 && (
            <p className="unmatched-note">{team.unmatchedPlayerCount} Sleeper player{team.unmatchedPlayerCount === 1 ? " is" : "s are"} not present in the current projection feed.</p>
          )}
        </div>
      )}
    </section>
  );
}

function LeagueGate({ message, onOpenTeam }: { message: string; onOpenTeam: () => void }) {
  return (
    <div className="waiver-gate">
      <p>{message}</p>
      <button className="utility-button" type="button" onClick={onOpenTeam}>Open Settings</button>
    </div>
  );
}

function recordLabel(team: LeagueTeam): string {
  return `${team.record.wins}-${team.record.losses}${team.record.ties ? `-${team.record.ties}` : ""}`;
}
