import { useState } from "react";
import { ChevronDown, RefreshCw, UserPlus } from "lucide-react";
import type {
  Player,
  RecommendationReport,
  LineupSlot,
} from "@fantasy-football/shared";
import { Availability, PlayerIdentity } from "./PlayerIdentity";

export function TeamLineup({
  report,
  loading,
  error,
  week,
  slots,
  onRefresh,
  onPlayers,
}: {
  report: RecommendationReport | null;
  loading: boolean;
  error: string | null;
  week: number;
  slots: LineupSlot[];
  onRefresh: () => void;
  onPlayers: () => void;
}) {
  const [filter, setFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  function row(player: Player, slot: string, reason?: string) {
    return (
      <div className="roster-entry" key={player.id}>
        <button
          className="team-player-row"
          aria-expanded={expanded === player.id}
          aria-label={`${player.name}, ${slot}, details`}
          onClick={() => setExpanded(expanded === player.id ? null : player.id)}
        >
          <span className={`lineup-slot slot-${slot.toLowerCase()}`}>
            {slot}
          </span>
          <PlayerIdentity player={player} />
          <span className="roster-availability">
            <Availability player={player} week={week} />
          </span>
          <span className="roster-bye">{player.byeWeek || "--"}</span>
          <strong className="roster-points">
            {player.hasProjection === false
              ? "--"
              : player.projectedPoints.toFixed(1)}
          </strong>
          <ChevronDown
            size={15}
            className={expanded === player.id ? "rotated" : ""}
          />
        </button>
        {expanded === player.id && (
          <div className="player-detail">
            <p>
              {reason ??
                (player.byeWeek === week
                  ? "On bye this week."
                  : ["OUT", "IR", "SUSPENDED"].includes(player.injuryStatus)
                    ? "Unavailable for this week's recommendation."
                    : "Other eligible players rank ahead in the recommended starting lineup.")}
            </p>
            {player.projectionBreakdown?.length ? (
              <dl>
                {player.projectionBreakdown.map((item) => (
                  <div key={item.stat}>
                    <dt>{item.label}</dt>
                    <dd>{item.fantasyPoints.toFixed(1)} pts</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted">
                A scoring breakdown is not available for this player.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
  const matches = (player: Player) =>
    filter === "ALL" || player.position === filter;
  const used = new Map<LineupSlot, number>();
  const starterRows = report
    ? slots.map((slot, index) => {
        const occurrence = used.get(slot) ?? 0;
        used.set(slot, occurrence + 1);
        const assignment = report.starters.filter((item) => item.slot === slot)[
          occurrence
        ];
        if (assignment)
          return matches(assignment.player)
            ? row(assignment.player, slot, assignment.reason)
            : null;
        return filter === "ALL" || filter === slot ? (
          <div key={`empty-${index}`} className="empty-slot">
            <span className="lineup-slot">{slot}</span>
            <span>No eligible player</span>
            <button className="text-action" onClick={onPlayers}>
              Find players
            </button>
          </div>
        ) : null;
      })
    : [];
  return (
    <section className="team-sheet" aria-labelledby="team-sheet-heading">
      <div className="sheet-heading">
        <div>
          <h2 id="team-sheet-heading">Recommended lineup</h2>
          <span className="muted">
            Week {week} <span aria-hidden="true">/</span> Starters &amp; bench
          </span>
        </div>
        <button
          className="icon-button"
          title="Refresh lineup"
          aria-label="Refresh lineup"
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw size={17} className={loading ? "spinning" : ""} />
        </button>
      </div>
      <div className="sheet-filters" aria-label="Filter roster by position">
        {["ALL", "QB", "RB", "WR", "TE", "K", "DST"].map((position) => (
          <button
            key={position}
            aria-pressed={filter === position}
            className={filter === position ? "selected" : ""}
            onClick={() => setFilter(position)}
          >
            {position === "ALL" ? "All players" : position}
          </button>
        ))}
      </div>
      <div className="team-table-labels" aria-hidden="true">
        <span>Slot</span>
        <span>Player</span>
        <span>Status</span>
        <span>Bye</span>
        <span>Proj.</span>
        <span />
      </div>
      {loading ? (
        <div className="lineup-loading" role="status">
          Loading your lineup...
          {[0, 1, 2, 3, 4].map((i) => (
            <div className="skeleton-row" key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <h3>Lineup could not load</h3>
          <p>{error}</p>
          <button className="utility-button" onClick={onRefresh}>
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      ) : report ? (
        <>
          <div className="roster-section-label">
            Starters{" "}
            <span>
              {report.starters.filter((item) => matches(item.player)).length}
            </span>
          </div>
          {starterRows}
          <div className="roster-section-label bench-label">
            Bench <span>{report.bench.filter(matches).length}</span>
          </div>
          {report.bench.filter(matches).map((player) => row(player, "BN"))}
          {!report.bench.some(matches) && (
            <p className="table-empty">
              No bench players{filter !== "ALL" ? ` at ${filter}` : ""}.
            </p>
          )}
        </>
      ) : (
        <div className="empty-state">
          <UserPlus size={28} />
          <h3>Your roster starts here</h3>
          <p>
            Connect your Sleeper team in Settings, or add players to a manual
            roster.
          </p>
          <button className="primary-button" onClick={onPlayers}>
            Browse players
          </button>
        </div>
      )}
      <div className="sheet-footnote">
        Recommendations only. Make lineup changes in your fantasy league.
      </div>
    </section>
  );
}
