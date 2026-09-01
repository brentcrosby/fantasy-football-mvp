import type { Player } from "@fantasy-football/shared";

interface RosterEditorProps {
  players: Player[];
  selectedPlayers: Player[];
  onAddPlayer: (player: Player) => void;
  onRemovePlayer: (playerId: string) => void;
  loading: boolean;
  error: string | null;
}

export function RosterEditor({ players, selectedPlayers, onAddPlayer, onRemovePlayer, loading, error }: RosterEditorProps) {
  const selectedPlayerIds = new Set(selectedPlayers.map((player) => player.id));

  return (
    <section className="panel roster-editor" aria-labelledby="roster-editor-heading">
      <div className="section-header roster-header">
        <div>
          <p className="eyebrow">Roster Builder</p>
          <h2 id="roster-editor-heading">Available Players</h2>
        </div>
        <span className="roster-count" aria-live="polite">
          {selectedPlayers.length} selected
        </span>
      </div>

      {loading && <p className="state-message">Loading available players...</p>}
      {error && <p className="error inline-error">{error}</p>}

      {!loading && !error && players.length === 0 && (
        <p className="state-message">No players are currently available</p>
      )}

      {!loading && !error && players.length > 0 && (
        <ul className="player-list" aria-label="Available players">
          {players.map((player) => {
            const isSelected = selectedPlayerIds.has(player.id);

            return (
              <li className={`player-row${isSelected ? " is-selected" : ""}`} key={player.id}>
                <div className="player-main">
                  <strong>{player.name}</strong>
                  <span>
                    {player.position} - {player.nflTeam}
                  </span>
                </div>

                <dl className="player-meta" aria-label={`${player.name} details`}>
                  <div>
                    <dt>Proj</dt>
                    <dd>{player.projectedPoints.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt>Bye</dt>
                    <dd>{player.byeWeek}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{statusLabel(player.injuryStatus)}</dd>
                  </div>
                </dl>

                {isSelected ? (
                  <button
                    className="secondary-button roster-action"
                    type="button"
                    aria-label={`Remove ${player.name} from roster`}
                    onClick={() => onRemovePlayer(player.id)}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    className="primary-button roster-action"
                    type="button"
                    aria-label={`Add ${player.name} to roster`}
                    onClick={() => onAddPlayer(player)}
                  >
                    Add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function statusLabel(status: Player["injuryStatus"]): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
