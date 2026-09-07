import { useState } from "react";

import type { Player, PlayerCatalogMetadata, Position } from "@fantasy-football/shared";

interface RosterEditorProps {
  players: Player[];
  selectedPlayers: Player[];
  metadata: PlayerCatalogMetadata | null;
  onAddPlayer: (player: Player) => void;
  onRemovePlayer: (playerId: string) => void;
  loading: boolean;
  error: string | null;
  disabled: boolean;
}

const positionFilters: Array<Position | "ALL"> = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];
const maximumVisiblePlayers = 75;

export function RosterEditor({
  players,
  selectedPlayers,
  metadata,
  onAddPlayer,
  onRemovePlayer,
  loading,
  error,
  disabled
}: RosterEditorProps) {
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<Position | "ALL">("ALL");
  const selectedPlayerIds = new Set(selectedPlayers.map((player) => player.id));
  const playerPool = [
    ...players,
    ...selectedPlayers.filter((player) => !players.some((availablePlayer) => availablePlayer.id === player.id))
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlayers = playerPool.filter((player) => {
    const matchesPosition = positionFilter === "ALL" || player.position === positionFilter;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      player.name.toLowerCase().includes(normalizedQuery) ||
      player.nflTeam.toLowerCase().includes(normalizedQuery);

    return matchesPosition && matchesQuery;
  });
  const visiblePlayers = filteredPlayers.slice(0, maximumVisiblePlayers);

  return (
    <section className="panel roster-editor" aria-labelledby="roster-editor-heading">
      <div className="section-header roster-header">
        <div>
          <p className="eyebrow">Roster Builder</p>
          <h2 id="roster-editor-heading">Player Pool</h2>
        </div>
        <span className="roster-count" aria-live="polite">
          {selectedPlayers.length} selected
        </span>
      </div>

      {metadata && (
        <div className="catalog-status">
          <strong>{metadata.source === "LIVE" ? `${metadata.season} Week ${metadata.week}` : "Sample data"}</strong>
          <span>{metadata.sourceLabel}</span>
          {metadata.updatedAt && <span>Updated {formatUpdatedAt(metadata.updatedAt)}</span>}
        </div>
      )}

      {loading && <p className="state-message">Loading available players...</p>}
      {error && <p className="error inline-error">{error}</p>}

      {!loading && !error && playerPool.length === 0 && (
        <p className="state-message">No players are currently available</p>
      )}

      {!loading && !error && playerPool.length > 0 && (
        <>
          <div className="player-toolbar">
            <label className="player-search">
              <span>Search players</span>
              <input
                type="search"
                value={query}
                placeholder="Name or NFL team"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="position-filters" aria-label="Filter players by position">
              {positionFilters.map((position) => (
                <button
                  className={positionFilter === position ? "is-active" : ""}
                  type="button"
                  aria-pressed={positionFilter === position}
                  key={position}
                  onClick={() => setPositionFilter(position)}
                >
                  {position}
                </button>
              ))}
            </div>
          </div>

          <p className="player-results-count" aria-live="polite">
            Showing {visiblePlayers.length} of {filteredPlayers.length} matching players
          </p>

          {visiblePlayers.length === 0 && <p className="state-message player-empty">No players match this filter.</p>}

          {visiblePlayers.length > 0 && (
            <ul className="player-list" aria-label="Available players">
              <li className="player-table-header" aria-hidden="true">
                <span>Player</span>
                <span>Week outlook</span>
                <span>Move</span>
              </li>
              {visiblePlayers.map((player) => {
                const isSelected = selectedPlayerIds.has(player.id);

                return (
                  <li className={`player-row${isSelected ? " is-selected" : ""}`} key={player.id}>
                    <div className="player-identity">
                      <span className={`position-badge position-${player.position.toLowerCase()}`}>
                        {player.position}
                      </span>
                      <div className="player-main">
                        <strong>{player.name}</strong>
                        <span>{player.nflTeam}</span>
                      </div>
                    </div>

                    <dl className="player-meta" aria-label={`${player.name} details`}>
                      <div>
                        <dt>Proj</dt>
                        <dd>{player.hasProjection === false ? "--" : player.projectedPoints.toFixed(1)}</dd>
                      </div>
                      <div>
                        <dt>Bye</dt>
                        <dd>{player.byeWeek}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd className={`injury-status injury-${player.injuryStatus.toLowerCase()}`}>
                          {statusLabel(player.injuryStatus)}
                        </dd>
                      </div>
                    </dl>

                    {isSelected ? (
                      <button
                        className="secondary-button roster-action"
                        type="button"
                        disabled={disabled}
                        aria-label={`Remove ${player.name} from roster`}
                        onClick={() => onRemovePlayer(player.id)}
                      >
                        Drop
                      </button>
                    ) : (
                      <button
                        className="primary-button roster-action"
                        type="button"
                        disabled={disabled}
                        aria-label={`Add ${player.name} to roster`}
                        onClick={() => onAddPlayer(player)}
                      >
                        + Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function statusLabel(status: Player["injuryStatus"]): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
