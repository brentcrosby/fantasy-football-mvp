import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  type AuthCredentials,
  type AuthenticatedUser,
  DEFAULT_LINEUP_SLOTS,
  type LineupSlot,
  type PersistedFantasyTeam,
  type Player,
  type PlayerCatalogMetadata,
  type RecommendationReport,
  type SavedWeeklyReport,
  type ScoringFormat,
  type ScoringRules,
  type TeamWriteRequest,
  type WaiverReport
} from "@fantasy-football/shared";

import { AuthScreen, type AuthMode } from "./components/AuthScreen";
import { LeagueControls, scoringFormatLabel } from "./components/LeagueControls";
import { ReportPanel } from "./components/ReportPanel";
import { ReportHistory } from "./components/ReportHistory";
import { RiskPanel } from "./components/RiskPanel";
import { RosterEditor } from "./components/RosterEditor";
import { SleeperImportPanel } from "./components/SleeperImportPanel";
import { TeamControls, type TeamPersistenceStatus } from "./components/TeamControls";
import { WaiverPanel } from "./components/WaiverPanel";
import {
  createTeam,
  fetchCurrentUser,
  fetchPlayers,
  fetchTeams,
  fetchWaiverReport,
  fetchWeeklyReports,
  generateRecommendation,
  login,
  logout,
  register,
  saveWeeklyReport,
  updateTeam
} from "./lib/api";

interface ReportInputs {
  week: number;
  scoringFormat: ScoringFormat;
  scoringRules: ScoringRules | null;
  lineupSlots: LineupSlot[];
  rosterIds: string[];
}

interface TeamSnapshot {
  name: string;
  scoringFormat: ScoringFormat;
  scoringRules: ScoringRules | null;
  lineupSlots: LineupSlot[];
  rosterIds: string[];
}

type WorkspaceTab = "TEAM" | "ROSTER" | "LINEUP" | "WAIVERS";

const WORKSPACE_TAB_ORDER: WorkspaceTab[] = ["TEAM", "ROSTER", "LINEUP", "WAIVERS"];
const WORKSPACE_TAB_IDS: Record<WorkspaceTab, string> = {
  TEAM: "team-tab",
  ROSTER: "roster-tab",
  LINEUP: "lineup-tab",
  WAIVERS: "waivers-tab"
};

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [teams, setTeams] = useState<PersistedFantasyTeam[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [playerCatalogMetadata, setPlayerCatalogMetadata] = useState<PlayerCatalogMetadata | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [savedTeamSnapshot, setSavedTeamSnapshot] = useState<TeamSnapshot | null>(null);
  const [week, setWeek] = useState(1);
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>("HALF_PPR");
  const [scoringRules, setScoringRules] = useState<ScoringRules | null>(null);
  const [lineupSlots, setLineupSlots] = useState<LineupSlot[]>([...DEFAULT_LINEUP_SLOTS]);
  const [report, setReport] = useState<RecommendationReport | null>(null);
  const [reportInputs, setReportInputs] = useState<ReportInputs | null>(null);
  const [savedReports, setSavedReports] = useState<SavedWeeklyReport[]>([]);
  const [viewedSavedReport, setViewedSavedReport] = useState<SavedWeeklyReport | null>(null);
  const [currentReportSavedId, setCurrentReportSavedId] = useState<string | null>(null);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [teamLoadError, setTeamLoadError] = useState<string | null>(null);
  const [teamSaveError, setTeamSaveError] = useState<string | null>(null);
  const [loadErrorBlocksSave, setLoadErrorBlocksSave] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("TEAM");
  const [waiverReport, setWaiverReport] = useState<WaiverReport | null>(null);
  const [waiverLoading, setWaiverLoading] = useState(false);
  const [waiverError, setWaiverError] = useState<string | null>(null);
  const waiverRequestSequence = useRef(0);

  const currentInputs = buildReportInputs(week, scoringFormat, scoringRules, lineupSlots, selectedPlayers);
  const currentTeam = teams.find((team) => team.id === teamId) ?? null;
  const currentTeamSnapshot = buildTeamSnapshot(teamName, scoringFormat, scoringRules, lineupSlots, selectedPlayers);
  const isTeamDirty = savedTeamSnapshot === null || !teamSnapshotsMatch(currentTeamSnapshot, savedTeamSnapshot);
  const isReportStale = report !== null && reportInputs !== null && !inputsMatch(currentInputs, reportInputs);
  const displayedReport = viewedSavedReport?.report ?? report;
  const displayedLineupSlots = viewedSavedReport?.settings.lineupSlots ?? lineupSlots;
  const unfilledSlots = displayedReport
    ? findUnfilledSlots(displayedLineupSlots, displayedReport.starters.map((assignment) => assignment.slot))
    : [];
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

  useEffect(() => {
    let active = true;

    if (!currentUser || !teamId) {
      setSavedReports([]);
      setReportsError(null);
      setReportsLoading(false);
      return () => {
        active = false;
      };
    }

    setReportsLoading(true);
    setReportsError(null);

    void fetchWeeklyReports(teamId)
      .then((reports) => {
        if (active) setSavedReports(reports);
      })
      .catch((apiError) => {
        if (active) setReportsError(errorMessage(apiError, "Something went wrong loading saved reports."));
      })
      .finally(() => {
        if (active) setReportsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser, teamId]);

  async function loadWorkspace() {
    setPlayersLoading(true);
    setTeamLoading(true);
    setPlayersError(null);
    setTeamLoadError(null);

    const [playersResult, teamsResult] = await Promise.allSettled([fetchPlayers(), fetchTeams()]);

    if (playersResult.status === "fulfilled") {
      setAvailablePlayers(playersResult.value.players);
      setPlayerCatalogMetadata(playersResult.value.metadata);

      if (playersResult.value.metadata.source === "LIVE" && playersResult.value.metadata.week) {
        setWeek(playersResult.value.metadata.week);
      }
    } else {
      setPlayersError(errorMessage(playersResult.reason, "Something went wrong loading players."));
    }

    if (teamsResult.status === "fulfilled") {
      setTeams(teamsResult.value);
      setLoadErrorBlocksSave(false);

      if (teamsResult.value[0]) {
        hydrateTeam(teamsResult.value[0]);
        setActiveTab("LINEUP");
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
    setScoringRules(team.settings.scoringRules ?? null);
    setLineupSlots([...team.settings.lineupSlots]);
    setSelectedPlayers(rosterPlayers);
    setSavedTeamSnapshot(
      buildTeamSnapshot(
        team.name,
        team.settings.scoringFormat,
        team.settings.scoringRules ?? null,
        team.settings.lineupSlots,
        rosterPlayers
      )
    );
    clearReportView();
    clearWaiverView();
  }

  function resetTeamDraft() {
    setTeamId(null);
    setTeamName("");
    setScoringFormat("HALF_PPR");
    setScoringRules(null);
    setLineupSlots([...DEFAULT_LINEUP_SLOTS]);
    setSelectedPlayers([]);
    setSavedTeamSnapshot(null);
    setReport(null);
    setReportInputs(null);
    setSavedReports([]);
    setReportsError(null);
    setViewedSavedReport(null);
    setCurrentReportSavedId(null);
    setTeamLoadError(null);
    setTeamSaveError(null);
    setLoadErrorBlocksSave(false);
    clearWaiverView();
    setActiveTab("TEAM");
  }

  function handleSelectTeam(nextTeamId: string) {
    const team = teams.find((candidate) => candidate.id === nextTeamId);

    if (team) {
      hydrateTeam(team);
      setTeamSaveError(null);
      setActiveTab("LINEUP");
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
      setPlayerCatalogMetadata(null);
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
    clearWaiverView();
    setSelectedPlayers((currentPlayers) => {
      if (currentPlayers.some((currentPlayer) => currentPlayer.id === player.id)) {
        return currentPlayers;
      }

      return [...currentPlayers, player];
    });
  }

  function removePlayer(playerId: string) {
    setTeamSaveError(null);
    clearWaiverView();
    setSelectedPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== playerId));
  }

  function handleTeamNameChange(name: string) {
    setTeamName(name);
    setTeamSaveError(null);
    clearWaiverView();
  }

  function handleScoringFormatChange(nextScoringFormat: ScoringFormat) {
    setScoringFormat(nextScoringFormat);
    if (nextScoringFormat !== "CUSTOM") {
      setScoringRules(null);
    }
    setTeamSaveError(null);
    clearWaiverView();
  }

  async function handleSaveTeam() {
    if (savingTeam || loadErrorBlocksSave || teamName.trim().length === 0 || !isTeamDirty) {
      return;
    }

    const request: TeamWriteRequest = {
      name: teamName,
      settings: { scoringFormat, lineupSlots, ...(scoringRules ? { scoringRules } : {}) },
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

  function handleSleeperImported(importedTeam: PersistedFantasyTeam) {
    hydrateTeam(importedTeam);
    setTeams((currentTeams) => [importedTeam, ...currentTeams.filter((team) => team.id !== importedTeam.id)]);
    setTeamLoadError(null);
    setTeamSaveError(null);
    setLoadErrorBlocksSave(false);
    setActiveTab("ROSTER");
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
        settings: { scoringFormat, lineupSlots, ...(scoringRules ? { scoringRules } : {}) },
        rosterPlayerIds: selectedPlayers.map((player) => player.id)
      });

      setReport(nextReport);
      setReportInputs(currentInputs);
      setViewedSavedReport(null);
      setCurrentReportSavedId(null);
    } catch (apiError) {
      setRecommendationError(errorMessage(apiError, "Something went wrong generating a lineup."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveReport() {
    if (!teamId || !report || isReportStale || isTeamDirty || savingReport || viewedSavedReport) {
      return;
    }

    setSavingReport(true);
    setReportsError(null);

    try {
      const savedReport = await saveWeeklyReport(teamId, { week: report.week });
      setSavedReports((currentReports) => [savedReport, ...currentReports]);
      setCurrentReportSavedId(savedReport.id);
    } catch (apiError) {
      setReportsError(errorMessage(apiError, "Something went wrong saving the report."));
    } finally {
      setSavingReport(false);
    }
  }

  async function handleScanWaivers() {
    if (!teamId || !currentTeam?.sleeper || isTeamDirty || waiverLoading) return;

    const requestSequence = ++waiverRequestSequence.current;
    setWaiverLoading(true);
    setWaiverError(null);

    try {
      const nextReport = await fetchWaiverReport(teamId);

      if (waiverRequestSequence.current === requestSequence) {
        setWaiverReport(nextReport);
      }
    } catch (apiError) {
      if (waiverRequestSequence.current === requestSequence) {
        setWaiverError(errorMessage(apiError, "Something went wrong scanning waivers."));
      }
    } finally {
      if (waiverRequestSequence.current === requestSequence) {
        setWaiverLoading(false);
      }
    }
  }

  function clearReportView() {
    setReport(null);
    setReportInputs(null);
    setViewedSavedReport(null);
    setCurrentReportSavedId(null);
  }

  function clearWaiverView() {
    waiverRequestSequence.current += 1;
    setWaiverReport(null);
    setWaiverError(null);
    setWaiverLoading(false);
  }

  function handleWorkspaceTabKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    const currentIndex = WORKSPACE_TAB_ORDER.indexOf(activeTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + WORKSPACE_TAB_ORDER.length) % WORKSPACE_TAB_ORDER.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % WORKSPACE_TAB_ORDER.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = WORKSPACE_TAB_ORDER.length - 1;
    }

    event.preventDefault();
    const nextTab = WORKSPACE_TAB_ORDER[nextIndex];
    setActiveTab(nextTab);
    requestAnimationFrame(() => document.getElementById(WORKSPACE_TAB_IDS[nextTab])?.focus());
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

      <nav className="workspace-tabs" role="tablist" aria-label="Team workspace" onKeyDown={handleWorkspaceTabKeyDown}>
        <WorkspaceTabButton
          id="team-tab"
          panelId="team-panel"
          label="Team"
          meta={teamId ? "Saved" : "Setup"}
          active={activeTab === "TEAM"}
          onClick={() => setActiveTab("TEAM")}
        />
        <WorkspaceTabButton
          id="roster-tab"
          panelId="roster-panel"
          label="Roster"
          meta={`${selectedPlayers.length} players`}
          active={activeTab === "ROSTER"}
          onClick={() => setActiveTab("ROSTER")}
        />
        <WorkspaceTabButton
          id="lineup-tab"
          panelId="lineup-panel"
          label="Lineup"
          meta={`Week ${displayedReport?.week ?? week}`}
          active={activeTab === "LINEUP"}
          onClick={() => setActiveTab("LINEUP")}
        />
        <WorkspaceTabButton
          id="waivers-tab"
          panelId="waivers-panel"
          label="Waivers"
          meta={currentTeam?.sleeper ? "Sleeper" : "Connect"}
          active={activeTab === "WAIVERS"}
          onClick={() => setActiveTab("WAIVERS")}
        />
      </nav>

      <section
        id="team-panel"
        className="workspace-panel team-workspace"
        role="tabpanel"
        aria-labelledby="team-tab"
        hidden={activeTab !== "TEAM"}
      >
          <SleeperImportPanel
            connection={currentTeam?.sleeper ?? null}
            disabled={savingTeam || teamLoading}
            onImported={handleSleeperImported}
          />
          <div className="team-settings-stack">
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
              hasImportedScoringRules={scoringRules !== null}
              disabled={savingTeam}
              weekLocked={playerCatalogMetadata?.source === "LIVE"}
              onWeekChange={setWeek}
              onScoringFormatChange={handleScoringFormatChange}
            />
          </div>
      </section>

      <section
        id="roster-panel"
        className="workspace-panel roster-workspace"
        role="tabpanel"
        aria-labelledby="roster-tab"
        hidden={activeTab !== "ROSTER"}
      >
          <RosterEditor
            players={availablePlayers}
            selectedPlayers={selectedPlayers}
            metadata={playerCatalogMetadata}
            onAddPlayer={addPlayer}
            onRemovePlayer={removePlayer}
            loading={playersLoading}
            error={playersError}
            disabled={savingTeam}
          />
      </section>

      <section
        id="lineup-panel"
        className="workspace-panel lineup-workspace"
        role="tabpanel"
        aria-labelledby="lineup-tab"
        hidden={activeTab !== "LINEUP"}
      >
          <section className="panel lineup-generate-panel" aria-labelledby="generate-heading">
            <div className="section-header">
              <div>
                <p className="eyebrow">Week {week} Decision</p>
                <h2 id="generate-heading">Starting Lineup</h2>
              </div>
            </div>

            <div className="generate-body lineup-generate-body">
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
              <div className="generate-messages">
                {selectedPlayers.length === 0 && <p className="state-message">Select at least one player to generate a lineup.</p>}
                {recommendationError && <p className="error inline-error">{recommendationError}</p>}
                {isReportStale && <p className="stale-message">This report is stale. Generate a new lineup to use the current roster and settings.</p>}
                {report && isTeamDirty && <p className="save-hint">Save the current team changes before archiving this report.</p>}
              </div>
              <div className="generate-actions">
                <button className="generate-button" type="button" disabled={selectedPlayers.length === 0 || submitting} onClick={handleGenerateLineup}>
                  {submitting ? "Generating..." : "Generate Lineup"}
                </button>
                <button
                  className="utility-button save-report-button"
                  type="button"
                  disabled={
                    !report ||
                    isReportStale ||
                    isTeamDirty ||
                    !teamId ||
                    savingReport ||
                    viewedSavedReport !== null ||
                    currentReportSavedId !== null
                  }
                  onClick={handleSaveReport}
                >
                  {savingReport
                    ? "Saving..."
                    : currentReportSavedId
                      ? "Report Saved"
                      : viewedSavedReport
                        ? "Viewing Saved"
                        : "Save Report"}
                </button>
              </div>
            </div>
          </section>

          {displayedReport && (
            <>
              {unfilledSlots.length > 0 && (
                <section className="warning-panel" aria-live="polite">
                  <strong>Unfilled lineup positions:</strong> {unfilledSlots.join(", ")}
                </section>
              )}

              <div className="dashboard-grid">
                <ReportPanel report={displayedReport} statusLabel={viewedSavedReport ? "Saved snapshot" : "Rule-based"} />
                <div className="dashboard-side">
                  <RiskPanel report={displayedReport} />
                  <ReportHistory
                    reports={savedReports}
                    loading={reportsLoading}
                    error={reportsError}
                    selectedReportId={viewedSavedReport?.id ?? null}
                    currentReportAvailable={report !== null}
                    onSelect={setViewedSavedReport}
                    onShowCurrent={() => setViewedSavedReport(null)}
                  />
                </div>
              </div>
            </>
          )}

          {!displayedReport && teamId && (
            <div className="history-only">
              <ReportHistory
                reports={savedReports}
                loading={reportsLoading}
                error={reportsError}
                selectedReportId={null}
                currentReportAvailable={false}
                onSelect={setViewedSavedReport}
                onShowCurrent={() => setViewedSavedReport(null)}
              />
            </div>
          )}
      </section>

      <section
        id="waivers-panel"
        className="workspace-panel waivers-workspace"
        role="tabpanel"
        aria-labelledby="waivers-tab"
        hidden={activeTab !== "WAIVERS"}
      >
        <WaiverPanel
          report={waiverReport}
          loading={waiverLoading}
          error={waiverError}
          hasSavedTeam={teamId !== null}
          connectedToSleeper={Boolean(currentTeam?.sleeper)}
          teamDirty={isTeamDirty}
          onScan={handleScanWaivers}
          onOpenTeam={() => setActiveTab("TEAM")}
        />
      </section>
    </main>
  );
}

function WorkspaceTabButton({
  id,
  panelId,
  label,
  meta,
  active,
  onClick
}: {
  id: string;
  panelId: string;
  label: string;
  meta: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      tabIndex={active ? 0 : -1}
      className={active ? "is-active" : undefined}
      onClick={onClick}
    >
      <span>{label}</span>
      <small>{meta}</small>
    </button>
  );
}

function buildReportInputs(
  week: number,
  scoringFormat: ScoringFormat,
  scoringRules: ScoringRules | null,
  lineupSlots: LineupSlot[],
  selectedPlayers: Player[]
): ReportInputs {
  return {
    week,
    scoringFormat,
    scoringRules,
    lineupSlots: [...lineupSlots],
    rosterIds: selectedPlayers.map((player) => player.id).sort()
  };
}

function buildTeamSnapshot(
  name: string,
  scoringFormat: ScoringFormat,
  scoringRules: ScoringRules | null,
  lineupSlots: LineupSlot[],
  selectedPlayers: Player[]
): TeamSnapshot {
  return {
    name: name.trim(),
    scoringFormat,
    scoringRules,
    lineupSlots: [...lineupSlots],
    rosterIds: selectedPlayers.map((player) => player.id).sort()
  };
}

function inputsMatch(left: ReportInputs, right: ReportInputs): boolean {
  return (
    left.week === right.week &&
    left.scoringFormat === right.scoringFormat &&
    scoringRulesMatch(left.scoringRules, right.scoringRules) &&
    arraysMatch(left.lineupSlots, right.lineupSlots) &&
    arraysMatch(left.rosterIds, right.rosterIds)
  );
}

function teamSnapshotsMatch(left: TeamSnapshot, right: TeamSnapshot): boolean {
  return (
    left.name === right.name &&
    left.scoringFormat === right.scoringFormat &&
    scoringRulesMatch(left.scoringRules, right.scoringRules) &&
    arraysMatch(left.lineupSlots, right.lineupSlots) &&
    arraysMatch(left.rosterIds, right.rosterIds)
  );
}

function arraysMatch<T>(left: T[], right: T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function scoringRulesMatch(left: ScoringRules | null, right: ScoringRules | null): boolean {
  if (left === null || right === null) return left === right;

  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
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
