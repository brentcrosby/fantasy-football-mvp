import {
  ArrowRight,
  Bell,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";
import type {
  LeagueOverview,
  LeagueTeam,
  RecommendationReport,
} from "@fantasy-football/shared";
import { Availability, PlayerIdentity } from "./PlayerIdentity";

function opponents(overview: LeagueOverview | null) {
  return {
    yours: overview?.teams.find(
      (team) => team.rosterId === overview.userRosterId,
    ),
    theirs: overview?.teams.find(
      (team) => team.rosterId === overview.matchup?.opponentRosterId,
    ),
  };
}

export function TeamBriefing({
  report,
  overview,
  loading,
  error,
  connected,
  dirty,
  onMatchup,
  onAssistant,
  onConnect,
  onLeague,
  onRetry,
}: {
  report: RecommendationReport | null;
  overview: LeagueOverview | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  dirty: boolean;
  onMatchup: () => void;
  onAssistant: () => void;
  onConnect: () => void;
  onLeague: () => void;
  onRetry: () => void;
}) {
  const { yours, theirs } = opponents(overview);
  const alerts = overview?.alertReport?.alerts.slice(0, 3) ?? [];
  const availability = report
    ? [...report.starters.map((item) => item.player), ...report.bench].filter(
        (player) =>
          player.injuryStatus !== "HEALTHY" || player.byeWeek === report.week,
      )
    : [];
  return (
    <aside className="team-briefing">
      <section className="briefing-section">
        <div className="rail-heading">
          <h2>This week's matchup</h2>
          <Swords size={17} />
        </div>
        {dirty && connected ? (
          <p className="muted">
            Save or discard your roster changes to load the league matchup.
          </p>
        ) : loading && !overview ? (
          <p className="muted" role="status">
            Loading matchup...
          </p>
        ) : error ? (
          <>
            <p className="muted">Matchup unavailable.</p>
            <button className="text-action" onClick={onRetry}>
              Try again <RefreshCw size={14} />
            </button>
          </>
        ) : yours && theirs ? (
          <>
            <div className="mini-matchup">
              <div>
                <span className="match-team-icon">
                  <Shield size={19} />
                </span>
                <strong>{yours.teamName}</strong>
                <b>{yours.projectedPoints.toFixed(1)}</b>
              </div>
              <span className="versus">vs</span>
              <div className="opponent">
                <span className="match-team-icon">
                  <Shield size={19} />
                </span>
                <strong>{theirs.teamName}</strong>
                <b>{theirs.projectedPoints.toFixed(1)}</b>
              </div>
            </div>
            <p className="mini-matchup-caption">Projected points</p>
            <button className="rail-link" onClick={onMatchup}>
              View matchup <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              {connected
                ? "No opponent is posted for this week yet."
                : "Connect your Sleeper league to see your opponent."}
            </p>
            <button
              className="rail-link"
              onClick={connected ? onMatchup : onConnect}
            >
              {connected ? "Open matchup" : "Connect league"}
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </section>
      <section className="briefing-section availability-section">
        <div className="rail-heading">
          <h2>Availability watch</h2>
          <span className="count-badge">{availability.length}</span>
        </div>
        {!report ? (
          <p className="muted">
            Your roster's injury and bye-week updates appear here.
          </p>
        ) : availability.length ? (
          <ul className="availability-list">
            {availability.map((player) => (
              <li key={player.id}>
                <span>
                  <strong>{player.name}</strong>
                  <small>
                    {player.position} / {player.nflTeam}
                  </small>
                </span>
                <Availability player={player} week={report.week} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No injury or bye-week flags on your roster.</p>
        )}
      </section>
      <section className="briefing-section assistant-entry">
        <Sparkles size={21} />
        <h2>A second opinion</h2>
        <p>
          Talk through a start, waiver move, or trade with your team in context.
        </p>
        <button className="rail-link" onClick={onAssistant}>
          Ask your assistant <ArrowRight size={16} />
        </button>
      </section>
      {overview && (
        <section className="briefing-section">
          <div className="rail-heading">
            <h2>Around your league</h2>
            <Bell size={16} />
          </div>
          {alerts.length ? (
            <ul className="briefing-alerts">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <strong>{alert.player.name}</strong>
                  <p>{alert.summary}</p>
                  <small>{alert.team.teamName}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No new roster alerts captured this week.</p>
          )}
          <button className="rail-link" onClick={onLeague}>
            League activity <ArrowRight size={16} />
          </button>
        </section>
      )}
    </aside>
  );
}

export function MatchupView({
  overview,
  loading,
  error,
  connected,
  dirty,
  onRefresh,
  onConnect,
}: {
  overview: LeagueOverview | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  dirty: boolean;
  onRefresh: () => void;
  onConnect: () => void;
}) {
  const { yours, theirs } = opponents(overview);
  if (!connected)
    return (
      <div className="empty-state connection-empty">
        <Swords size={32} />
        <h2>Meet your weekly opponent</h2>
        <p>
          Connect a Sleeper team to load your league's head-to-head matchup.
        </p>
        <button className="primary-button" onClick={onConnect}>
          Connect Sleeper
        </button>
      </div>
    );
  if (dirty)
    return (
      <div className="empty-state">
        <h2>Your roster has unsaved changes</h2>
        <p>Save or discard them above to load your league matchup.</p>
      </div>
    );
  if (loading && !overview)
    return (
      <div className="empty-state" role="status">
        Loading your matchup...
      </div>
    );
  if (!yours || !theirs || !overview?.matchup)
    return (
      <div className="empty-state">
        <Swords size={30} />
        <h2>{error ? "Matchup could not load" : "No matchup posted"}</h2>
        <p>{error ?? "An opponent has not been assigned for this week yet."}</p>
        <button
          className="utility-button"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    );
  // Pair repeated positions by occurrence instead of assuming each slot is unique.
  const slots = [...yours.starters.map((item) => item.slot)];
  for (const item of theirs.starters) {
    if (
      slots.filter((slot) => slot === item.slot).length <
      theirs.starters.filter((other) => other.slot === item.slot).length
    )
      slots.push(item.slot);
  }
  const occurrences = new Map<string, number>();
  return (
    <section className="head-to-head">
      <div className="sheet-heading">
        <div>
          <h2>Week {overview.week}</h2>
          <span className="muted">{overview.league.name}</span>
        </div>
        <button
          className="icon-button"
          title="Refresh matchup"
          aria-label="Refresh matchup"
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw size={17} className={loading ? "spinning" : ""} />
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="head-to-head-score">
        <MatchupTeam team={yours} yours />
        <span className="versus">VS</span>
        <MatchupTeam team={theirs} />
      </div>
      <div className="matchup-margin">
        <span>Projected edge</span>
        <strong>
          {overview.matchup.projectedMargin === 0
            ? "Even"
            : `${overview.matchup.projectedMargin > 0 ? yours.teamName : theirs.teamName} +${Math.abs(overview.matchup.projectedMargin).toFixed(1)}`}
        </strong>
      </div>
      <div className="head-to-head-labels">
        <span>Your recommended starters</span>
        <span>Slot</span>
        <span>Opponent's recommended starters</span>
      </div>
      {slots.map((slot, index) => {
        const occurrence = occurrences.get(slot) ?? 0;
        occurrences.set(slot, occurrence + 1);
        const left = yours.starters.filter((item) => item.slot === slot)[
          occurrence
        ]?.player;
        const right = theirs.starters.filter((item) => item.slot === slot)[
          occurrence
        ]?.player;
        return (
          <div className="head-to-head-row" key={`${slot}-${index}`}>
            <div>
              {left ? (
                <>
                  <PlayerIdentity player={left} />
                  <strong>
                    {left.hasProjection === false
                      ? "--"
                      : left.projectedPoints.toFixed(1)}
                  </strong>
                </>
              ) : (
                <span className="muted">Empty slot</span>
              )}
            </div>
            <span className="lineup-slot">{slot}</span>
            <div>
              {right ? (
                <>
                  <strong>
                    {right.hasProjection === false
                      ? "--"
                      : right.projectedPoints.toFixed(1)}
                  </strong>
                  <PlayerIdentity player={right} />
                </>
              ) : (
                <span className="muted">Empty slot</span>
              )}
            </div>
          </div>
        );
      })}
      <p className="sheet-footnote">
        Recommended lineups based on {overview.projectionSource}. These may
        differ from the starters managers have set in Sleeper. Projections are
        not live scores.
      </p>
      {(yours.unmatchedPlayerCount > 0 || theirs.unmatchedPlayerCount > 0) && (
        <p className="error">
          Some league players are missing from the projection feed. Totals may
          be incomplete.
        </p>
      )}
    </section>
  );
}

function MatchupTeam({
  team,
  yours = false,
}: {
  team: LeagueTeam;
  yours?: boolean;
}) {
  return (
    <div className={`head-to-head-team ${yours ? "your-team" : "opponent"}`}>
      <span className="match-team-icon">
        <Shield size={25} />
      </span>
      <span className="eyebrow">{yours ? "YOUR TEAM" : "OPPONENT"}</span>
      <h3>{team.teamName}</h3>
      <span className="muted">
        {team.record.wins}-{team.record.losses}
        {team.record.ties ? `-${team.record.ties}` : ""} / {team.ownerName}
      </span>
      <b>{team.projectedPoints.toFixed(1)}</b>
      <span className="muted">Projected points</span>
      {team.actualPoints !== null && (
        <small>{team.actualPoints.toFixed(1)} actual points</small>
      )}
    </div>
  );
}
