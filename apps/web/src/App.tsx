import { useEffect, useState } from "react";
import {
  type AuthCredentials,
  type AuthenticatedUser,
  DEFAULT_LINEUP_SLOTS,
  type LineupSlot,
  type PersistedFantasyTeam,
  type Player,
  type RecommendationReport,
  type ScoringFormat,
  type TeamWriteRequest
} from "@fantasy-football/shared";

import { AuthScreen, type AuthMode } from "./components/AuthScreen";
import { LeagueControls, scoringFormatLabel } from "./components/LeagueControls";
import { ReportPanel } from "./components/ReportPanel";
import { RiskPanel } from "./components/RiskPanel";
import { RosterEditor } from "./components/RosterEditor";
import { TeamControls, type TeamPersistenceStatus } from "./components/TeamControls";
import {
  createTeam,
  fetchCurrentUser,
  fetchPlayers,
  fetchTeams,
  generateRecommendation,
  login,
  logout,
  register,
  updateTeam
} from "./lib/api";

interface ReportInputs {
  week: number;
  scoringFormat: ScoringFormat;
  lineupSlots: LineupSlot[];
  rosterIds: string[];
}

interface TeamSnapshot {
  name: string;
  scoringFormat: ScoringFormat;
  lineupSlots: LineupSlot[];
  rosterIds: string[];
}

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [teams, setTeams] = useState<PersistedFantasyTeam[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [savedTeamSnapshot, setSavedTeamSnapshot] = useState<TeamSnapshot | null>(null);
  const [week, setWeek] = useState(1);
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>("HALF_PPR");
  const [lineupSlots, setLineupSlots] = useState<LineupSlot[]>([...DEFAULT_LINEUP_SLOTS]);
  const [report, setReport] = useState<RecommendationReport | null>(null);
  const [reportInputs, setReportInputs] = useState<ReportInputs | null>(null);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [teamLoadError, setTeamLoadError] = useState<string | null>(null);
  const [teamSaveError, setTeamSaveError] = useState<string | null>(null);
  const [loadErrorBlocksSave, setLoadErrorBlocksSave] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const currentInputs = buildReportInputs(week, scoringFormat, lineupSlots, selectedPlayers);
  const currentTeamSnapshot = buildTeamSnapshot(teamName, scoringFormat, lineupSlots, selectedPlayers);
  const isTeamDirty = savedTeamSnapshot === null || !teamSnapshotsMatch(currentTeamSnapshot, savedTeamSnapshot);
  const isReportStale = report !== null && reportInputs !== null && !inputsMatch(currentInputs, reportInputs);
  const unfilledSlots = report ? findUnfilledSlots(lineupSlots, report.starters.map((assignment) => assignment.slot)) : [];
  const persistenceStatus = getPersistenceStatus({
    teamLoading,
    savingTeam,
    teamLoadError,
    teamSaveError,
    savedTeamSnapshot,
    isTeamDirty
  });

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const user = await fetchCurrentUser();

        if (!active) return;
        setCurrentUser(user);

        if (user) {
          await loadWorkspace();
        } else {
          setPlayersLoading(false);
          setTeamLoading(false);
        }
      } catch (apiError) {
        if (active) {
          setAuthError(errorMessage(apiError, "Something went wrong checking your session."));
        }
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function loadWorkspace() {
    setPlayersLoading(true);
    setTeamLoading(true);
    setPlayersError(null);
    setTeamLoadError(null);

    const [playersResult, teamsResult] = await Promise.allSettled([fetchPlayers(), fetchTeams()]);

    if (playersResult.status === "fulfilled") {
      setAvailablePlayers(playersResult.value);
    } else {
      setPlayersError(errorMessage(playersResult.reason, "Something went wrong loading players."));
    }

    if (teamsResult.status === "fulfilled") {
      setTeams(teamsResult.value);
      setLoadErrorBlocksSave(false);

      if (teamsResult.value[0]) {
        hydrateTeam(teamsResult.value[0]);
      } else {
        resetTeamDraft();
      }
    } else {
      setTeamLoadError(errorMessage(teamsResult.reason, "Something went wrong loading your teams."));
      setLoadErrorBlocksSave(true);
    }

    setPlayersLoading(false);
    setTeamLoading(false);
  }

  function hydrateTeam(team: PersistedFantasyTeam) {
    const rosterPlayers = team.roster.map(({ player }) => player);

    setTeamId(team.id);
    setTeamName(team.name);
    setScoringFormat(team.settings.scoringFormat);
    setLineupSlots([...team.settings.lineupSlots]);
    setSelectedPlayers(rosterPlayers);
    setSavedTeamSnapshot(buildTeamSnapshot(team.name, team.settings.scoringFormat, team.settings.lineupSlots, rosterPlayers));
  }

  function resetTeamDraft() {
    setTeamId(null);
    setTeamName("");
    setScoringFormat("HALF_PPR");
    setLineupSlots([...DEFAULT_LINEUP_SLOTS]);
    setSelectedPlayers([]);
    setSavedTeamSnapshot(null);
    setReport(null);
    setReportInputs(null);
    setTeamLoadError(null);
    setTeamSaveError(null);
    setLoadErrorBlocksSave(false);
  }

  function handleSelectTeam(nextTeamId: string) {
    const team = teams.find((candidate) => candidate.id === nextTeamId);

    if (team) {
      hydrateTeam(team);
      setReport(null);
      setReportInputs(null);
      setTeamSaveError(null);
    }
  }

  async function handleAuthenticate(mode: AuthMode, credentials: AuthCredentials) {
    if (authSubmitting) return;

    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const user = mode === "login" ? await login(credentials) : await register(credentials);
      setCurrentUser(user);
      await loadWorkspace();
    } catch (apiError) {
      setAuthError(errorMessage(apiError, mode === "login" ? "Could not sign in." : "Could not create the account."));
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logout();
      setCurrentUser(null);
      setTeams([]);
      setAvailablePlayers([]);
      resetTeamDraft();
      setAuthError(null);
    } catch (apiError) {
      setTeamSaveError(errorMessage(apiError, "Could not sign out."));
    } finally {
      setLoggingOut(false);
    }
  }

  function addPlayer(player: Player) {
    setTeamSaveError(null);
    setSelectedPlayers((currentPlayers) => {
      if (currentPlayers.some((currentPlayer) => currentPlayer.id === player.id)) {
        return currentPlayers;
      }

      return [...currentPlayers, player];
    });
  }

  function removePlayer(playerId: string) {
    setTeamSaveError(null);
    setSelectedPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== playerId));
  }

  function handleTeamNameChange(name: string) {
    setTeamName(name);
    setTeamSaveError(null);
  }

  function handleScoringFormatChange(nextScoringFormat: ScoringFormat) {
    setScoringFormat(nextScoringFormat);
    setTeamSaveError(null);
  }

  async function handleSaveTeam() {
    if (savingTeam || loadErrorBlocksSave || teamName.trim().length === 0 || !isTeamDirty) {
      return;
    }

    const request: TeamWriteRequest = {
      name: teamName,
      settings: { scoringFormat, lineupSlots },
      rosterPlayerIds: selectedPlayers.map((player) => player.id)
    };

    setSavingTeam(true);
    setTeamSaveError(null);

    try {
      const savedTeam = teamId ? await updateTeam(teamId, request) : await createTeam(request);

      hydrateTeam(savedTeam);
      setTeams((currentTeams) => [savedTeam, ...currentTeams.filter((team) => team.id !== savedTeam.id)]);
      setTeamLoadError(null);
      setLoadErrorBlocksSave(false);
    } catch (apiError) {
      setTeamSaveError(errorMessage(apiError, "Something went wrong saving the team."));
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleGenerateLineup() {
    if (selectedPlayers.length === 0 || submitting) {
      return;
    }

    setSubmitting(true);
    setRecommendationError(null);

    try {
      const nextReport = await generateRecommendation({
        week,
        settings: { scoringFormat, lineupSlots },
        rosterPlayerIds: selectedPlayers.map((player) => player.id)
      });

      setReport(nextReport);
      setReportInputs(currentInputs);
    } catch (apiError) {
      setRecommendationError(errorMessage(apiError, "Something went wrong generating a lineup."));
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !currentUser) {
    return <AuthScreen loading={authLoading || authSubmitting} error={authError} onSubmit={handleAuthenticate} />;
  }

  return (
    <main className="app-shell">
      <div className="app-bar">
        <div className="app-brand">
          <span className="brand-mark" aria-hidden="true">FF</span>
          <span>
            <strong>Lineup Assistant</strong>
            <small>Fantasy decision support</small>
          </span>
        </div>
        <div className="account-controls">
          <span>{currentUser.email}</span>
          <button className="utility-button" type="button" disabled={loggingOut} onClick={handleLogout}>
            {loggingOut ? "Signing Out..." : "Sign Out"}
          </button>
        </div>
      </div>

      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">Weekly Command Center</p>
          <h1>{teamName.trim() || "Build your lineup"}</h1>
          <p className="subtitle">Set the roster. Check availability. Start the highest-projected eligible lineup.</p>
        </div>
        <dl className="scoreboard" aria-label="Current lineup settings">
          <div>
            <dt>Week</dt>
            <dd>{week}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{scoringFormatLabel(scoringFormat)}</dd>
          </div>
          <div>
            <dt>Roster</dt>
            <dd>{selectedPlayers.length}</dd>
          </div>
        </dl>
      </header>

      <div className="workflow-grid">
        <div className="workflow-main">
          <TeamControls
            name={teamName}
            status={persistenceStatus}
            hasSavedTeam={teamId !== null}
            loadError={teamLoadError}
            saveError={teamSaveError}
            saveDisabled={savingTeam || teamLoading || loadErrorBlocksSave || teamName.trim().length === 0 || !isTeamDirty}
            controlsDisabled={savingTeam}
            teams={teams}
            selectedTeamId={teamId}
            onNameChange={handleTeamNameChange}
            onSelectTeam={handleSelectTeam}
            onNewTeam={resetTeamDraft}
            onSave={handleSaveTeam}
          />
          <LeagueControls
            week={week}
            scoringFormat={scoringFormat}
            disabled={savingTeam}
            onWeekChange={setWeek}
            onScoringFormatChange={handleScoringFormatChange}
          />
          <RosterEditor
            players={availablePlayers}
            selectedPlayers={selectedPlayers}
            onAddPlayer={addPlayer}
            onRemovePlayer={removePlayer}
            loading={playersLoading}
            error={playersError}
            disabled={savingTeam}
          />
        </div>

        <aside className="panel generate-panel" aria-labelledby="generate-heading">
          <div className="section-header">
            <div>
              <p className="eyebrow">Week {week} Decision</p>
              <h2 id="generate-heading">Starting Lineup</h2>
            </div>
          </div>

          <div className="generate-body">
            <dl className="generate-stats">
              <div>
                <dt>Players</dt>
                <dd>{selectedPlayers.length}</dd>
              </div>
              <div>
                <dt>Slots</dt>
                <dd>{lineupSlots.length}</dd>
              </div>
            </dl>
            {selectedPlayers.length === 0 && <p className="state-message">Select at least one player to generate a lineup.</p>}
            {recommendationError && <p className="error inline-error">{recommendationError}</p>}
            {isReportStale && <p className="stale-message">This report is stale. Generate a new lineup to use the current roster and settings.</p>}

            <button className="generate-button" type="button" disabled={selectedPlayers.length === 0 || submitting} onClick={handleGenerateLineup}>
              {submitting ? "Generating..." : "Generate Lineup"}
            </button>
          </div>
        </aside>
      </div>

      {report && (
        <>
          {unfilledSlots.length > 0 && (
            <section className="warning-panel" aria-live="polite">
              <strong>Unfilled lineup positions:</strong> {unfilledSlots.join(", ")}
            </section>
          )}

          <div className="dashboard-grid">
            <ReportPanel report={report} />
            <RiskPanel report={report} />
          </div>
        </>
      )}
    </main>
  );
}

function buildReportInputs(
  week: number,
  scoringFormat: ScoringFormat,
  lineupSlots: LineupSlot[],
  selectedPlayers: Player[]
): ReportInputs {
  return {
    week,
    scoringFormat,
    lineupSlots: [...lineupSlots],
    rosterIds: selectedPlayers.map((player) => player.id).sort()
  };
}

function buildTeamSnapshot(
  name: string,
  scoringFormat: ScoringFormat,
  lineupSlots: LineupSlot[],
  selectedPlayers: Player[]
): TeamSnapshot {
  return {
    name: name.trim(),
    scoringFormat,
    lineupSlots: [...lineupSlots],
    rosterIds: selectedPlayers.map((player) => player.id).sort()
  };
}

function inputsMatch(left: ReportInputs, right: ReportInputs): boolean {
  return (
    left.week === right.week &&
    left.scoringFormat === right.scoringFormat &&
    arraysMatch(left.lineupSlots, right.lineupSlots) &&
    arraysMatch(left.rosterIds, right.rosterIds)
  );
}

function teamSnapshotsMatch(left: TeamSnapshot, right: TeamSnapshot): boolean {
  return (
    left.name === right.name &&
    left.scoringFormat === right.scoringFormat &&
    arraysMatch(left.lineupSlots, right.lineupSlots) &&
    arraysMatch(left.rosterIds, right.rosterIds)
  );
}

function arraysMatch<T>(left: T[], right: T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function getPersistenceStatus(input: {
  teamLoading: boolean;
  savingTeam: boolean;
  teamLoadError: string | null;
  teamSaveError: string | null;
  savedTeamSnapshot: TeamSnapshot | null;
  isTeamDirty: boolean;
}): TeamPersistenceStatus {
  if (input.teamLoading) return "loading";
  if (input.savingTeam) return "saving";
  if (input.teamSaveError) return "save-error";
  if (input.teamLoadError) return "load-error";
  if (input.savedTeamSnapshot === null) return "unsaved";
  return input.isTeamDirty ? "dirty" : "saved";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function findUnfilledSlots(expectedSlots: LineupSlot[], starterSlots: LineupSlot[]): string[] {
  const expectedCounts = countSlots(expectedSlots);
  const starterCounts = countSlots(starterSlots);

  return Object.entries(expectedCounts).flatMap(([slot, expectedCount]) => {
    const missingCount = expectedCount - (starterCounts[slot as LineupSlot] ?? 0);

    if (missingCount <= 0) {
      return [];
    }

    return missingCount === 1 ? slot : `${slot} x${missingCount}`;
  });
}

function countSlots(slots: LineupSlot[]): Partial<Record<LineupSlot, number>> {
  return slots.reduce<Partial<Record<LineupSlot, number>>>((counts, slot) => {
    counts[slot] = (counts[slot] ?? 0) + 1;
    return counts;
  }, {});
}
