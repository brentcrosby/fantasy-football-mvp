import { useEffect, useState, type FormEvent } from "react";
import type {
  PersistedFantasyTeam,
  SleeperImportPreview,
  SleeperLeagueLookup,
  SleeperTeamConnection
} from "@fantasy-football/shared";

import { importSleeperTeam, lookupSleeperLeagues, previewSleeperImport } from "../lib/api";

interface SleeperImportPanelProps {
  connection: SleeperTeamConnection | null;
  disabled: boolean;
  onImported: (team: PersistedFantasyTeam) => void;
}

export function SleeperImportPanel({ connection, disabled, onImported }: SleeperImportPanelProps) {
  const [username, setUsername] = useState(connection?.username ?? "");
  const [lookup, setLookup] = useState<SleeperLeagueLookup | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState(connection?.leagueId ?? "");
  const [preview, setPreview] = useState<SleeperImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUsername(connection?.username ?? "");
    setSelectedLeagueId(connection?.leagueId ?? "");
    setLookup(null);
    setPreview(null);
    setError(null);
  }, [connection?.leagueId, connection?.username]);

  async function handleLookup(event: FormEvent) {
    event.preventDefault();

    if (!username.trim() || loading) return;

    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const result = await lookupSleeperLeagues(username.trim());
      setLookup(result);
      setUsername(result.user.username);
      setSelectedLeagueId((current) =>
        result.leagues.some((league) => league.id === current) ? current : (result.leagues[0]?.id ?? "")
      );
    } catch (requestError) {
      setLookup(null);
      setSelectedLeagueId("");
      setError(errorMessage(requestError, "Could not find Sleeper leagues."));
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview(requestUsername = username, leagueId = selectedLeagueId) {
    if (!requestUsername.trim() || !leagueId || loading) return;

    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      setPreview(await previewSleeperImport({ username: requestUsername.trim(), leagueId }));
    } catch (requestError) {
      setError(errorMessage(requestError, "Could not preview the Sleeper team."));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!preview?.canImport || importing) return;

    setImporting(true);
    setError(null);

    try {
      const importedTeam = await importSleeperTeam({
        username: preview.user.username,
        leagueId: preview.league.id
      });
      onImported(importedTeam);
      setPreview(null);
      setLookup(null);
    } catch (requestError) {
      setError(errorMessage(requestError, "Could not import the Sleeper team."));
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="panel sleeper-import" aria-labelledby="sleeper-import-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">Roster Sync</p>
          <h2 id="sleeper-import-heading">Import from Sleeper</h2>
        </div>
        {connection && <span className="status-pill sleeper-linked">Connected</span>}
      </div>

      <form className="sleeper-lookup" onSubmit={handleLookup}>
        <label className="field" htmlFor="sleeper-username">
          <span>Sleeper Username</span>
          <input
            id="sleeper-username"
            type="text"
            maxLength={50}
            value={username}
            disabled={disabled || loading || importing}
            placeholder="Enter your Sleeper username"
            autoComplete="off"
            onChange={(event) => {
              setUsername(event.target.value);
              setLookup(null);
              setPreview(null);
            }}
          />
        </label>
        <button className="utility-button" type="submit" disabled={disabled || loading || importing || !username.trim()}>
          {loading ? "Loading..." : "Find Leagues"}
        </button>
        {connection && (
          <button
            className="utility-button"
            type="button"
            disabled={disabled || loading || importing}
            onClick={() => void handlePreview(connection.username, connection.leagueId)}
          >
            Preview Refresh
          </button>
        )}
      </form>

      {lookup && (
        <div className="sleeper-league-picker">
          <label className="field" htmlFor="sleeper-league">
            <span>{lookup.season} League</span>
            <select
              id="sleeper-league"
              value={selectedLeagueId}
              disabled={loading || importing || lookup.leagues.length === 0}
              onChange={(event) => {
                setSelectedLeagueId(event.target.value);
                setPreview(null);
              }}
            >
              {lookup.leagues.length === 0 && <option value="">No current leagues found</option>}
              {lookup.leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name} ({league.status.replaceAll("_", " ")})
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-button"
            type="button"
            disabled={!selectedLeagueId || loading || importing}
            onClick={() => void handlePreview()}
          >
            Preview Import
          </button>
        </div>
      )}

      {error && <p className="error sleeper-message">{error}</p>}

      {preview && (
        <div className="sleeper-preview">
          <div className="sleeper-preview-title">
            <div>
              <span>{preview.league.name}</span>
              <strong>{preview.teamName}</strong>
            </div>
            <span className={`status-pill${preview.canImport ? " sleeper-ready" : " sleeper-blocked"}`}>
              {preview.canImport ? "Ready" : "Needs Review"}
            </span>
          </div>

          <dl className="sleeper-preview-stats">
            <div>
              <dt>Roster</dt>
              <dd>{preview.rosterPlayers.length}</dd>
            </div>
            <div>
              <dt>Projected</dt>
              <dd>{preview.rosterPlayers.filter((player) => player.hasProjection !== false).length}</dd>
            </div>
            <div>
              <dt>Scoring</dt>
              <dd>{preview.settings ? formatScoring(preview.settings.scoringFormat) : "Unsupported"}</dd>
            </div>
            <div>
              <dt>Slots</dt>
              <dd>{preview.settings?.lineupSlots.length ?? 0}</dd>
            </div>
          </dl>

          {preview.settings && <p className="sleeper-lineup">{preview.settings.lineupSlots.join(" / ")}</p>}

          {preview.warnings.length > 0 && (
            <ul className="sleeper-warnings">
              {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}

          <button
            className="primary-button sleeper-import-button"
            type="button"
            disabled={!preview.canImport || importing}
            onClick={handleImport}
          >
            {importing ? "Importing..." : preview.existingTeamId ? "Refresh Team" : "Import Team"}
          </button>
        </div>
      )}
    </section>
  );
}

function formatScoring(scoringFormat: string): string {
  if (scoringFormat === "HALF_PPR") return "Half PPR";
  if (scoringFormat === "PPR") return "PPR";
  return "Standard";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
