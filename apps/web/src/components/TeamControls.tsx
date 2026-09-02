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
  onNameChange: (name: string) => void;
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
  onNameChange,
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
