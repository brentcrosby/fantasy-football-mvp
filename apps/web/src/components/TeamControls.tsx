export type TeamPersistenceStatus = "loading" | "unsaved" | "dirty" | "saving" | "saved" | "load-error" | "save-error";

const STATUS_LABELS: Record<TeamPersistenceStatus, string> = {
  loading: "Loading",
  unsaved: "Unsaved",
  dirty: "Unsaved changes",
  saving: "Saving",
  saved: "Saved",
  "load-error": "Load error",
  "save-error": "Save error"
};

interface TeamControlsProps {
  name: string;
  status: TeamPersistenceStatus;
  hasSavedTeam: boolean;
  loadError: string | null;
  saveError: string | null;
  saveDisabled: boolean;
  controlsDisabled: boolean;
  teams: PersistedFantasyTeam[];
  selectedTeamId: string | null;
  onNameChange: (name: string) => void;
  onSelectTeam: (teamId: string) => void;
  onNewTeam: () => void;
  onSave: () => void;
}

export function TeamControls({
  name,
  status,
  hasSavedTeam,
  loadError,
  saveError,
  saveDisabled,
  controlsDisabled,
  teams,
  selectedTeamId,
  onNameChange,
  onSelectTeam,
  onNewTeam,
  onSave
}: TeamControlsProps) {
  return (
    <section className="panel team-controls" aria-labelledby="team-controls-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">My Team</p>
          <h2 id="team-controls-heading">Team Profile</h2>
        </div>
        <span className={`persistence-status status-${status}`} aria-live="polite">
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="team-picker-row">
        <label className="field" htmlFor="saved-team">
          <span>Saved Team</span>
          <select
            id="saved-team"
            value={selectedTeamId ?? ""}
            disabled={controlsDisabled || teams.length === 0}
            onChange={(event) => onSelectTeam(event.target.value)}
          >
            {selectedTeamId === null && <option value="">New unsaved team</option>}
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </label>

        <button className="utility-button" type="button" disabled={controlsDisabled} onClick={onNewTeam}>
          + New Team
        </button>
      </div>

      <div className="team-controls-body">
        <label className="field" htmlFor="team-name">
          <span>Team Name</span>
          <input
            id="team-name"
            type="text"
            maxLength={100}
            value={name}
            disabled={controlsDisabled}
            placeholder="Enter a fantasy team name"
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>

        <button className="primary-button save-team-button" type="button" disabled={saveDisabled} onClick={onSave}>
          {status === "saving" ? "Saving..." : hasSavedTeam ? "Update Team" : "Save Team"}
        </button>
      </div>

      {loadError && <p className="error team-message">{loadError}</p>}
      {saveError && <p className="error team-message">{saveError}</p>}
    </section>
  );
}
import type { PersistedFantasyTeam } from "@fantasy-football/shared";
