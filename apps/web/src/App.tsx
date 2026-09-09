import { useEffect, useRef, useState } from "react";
import {
  type AuthCredentials,
  type AssistantRequest,
  type AuthenticatedUser,
  DEFAULT_LINEUP_SLOTS,
  type LeagueOverview,
  type LineupSlot,
  type PersistedFantasyTeam,
  type Player,
  type PlayerCatalogMetadata,
  type SavedWeeklyReport,
  type ScoringFormat,
  type ScoringRules,
  type TeamWriteRequest,
  type WaiverReport,
} from "@fantasy-football/shared";

import { AuthScreen, type AuthMode } from "./components/AuthScreen";
import { AssistantPanel } from "./components/AssistantPanel";
import {
  LeagueControls,
  scoringFormatLabel,
} from "./components/LeagueControls";
import { LeaguePanel } from "./components/LeaguePanel";
import { ModelPanel } from "./components/ModelPanel";
import { ReportPanel } from "./components/ReportPanel";
import { ReportHistory } from "./components/ReportHistory";
import { TeamLineup } from "./components/TeamLineup";
import { useLineup } from "./hooks/useLineup";
import { MatchupView, TeamBriefing } from "./components/TeamBriefing";
import {
  Activity,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  LogOut,
  Search,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Save,
  X,
} from "lucide-react";
import { RosterEditor } from "./components/RosterEditor";
import { SleeperImportPanel } from "./components/SleeperImportPanel";
import {
  TeamControls,
  type TeamPersistenceStatus,
} from "./components/TeamControls";
import { WaiverPanel } from "./components/WaiverPanel";
import {
  createTeam,
  askAssistant,
  fetchCurrentUser,
  fetchLeagueOverview,
  fetchPlayers,
  fetchTeams,
  fetchWaiverReport,
  fetchWeeklyReports,
  login,
  logout,
  register,
  saveWeeklyReport,
  updateTeam,
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

type WorkspaceTab =
  "TEAM" | "ROSTER" | "LEAGUE" | "LINEUP" | "WAIVERS" | "ASSISTANT" | "MATCHUP";
const NAVIGATION = [
  { id: "LINEUP", label: "My Team", icon: Users },
  { id: "MATCHUP", label: "Matchup", icon: Swords },
  { id: "ROSTER", label: "Players", icon: Search },
  { id: "LEAGUE", label: "League", icon: Trophy },
  { id: "ASSISTANT", label: "Assistant", icon: Sparkles },
  { id: "TEAM", label: "Settings", icon: Settings },
] as const;

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );
  const [teams, setTeams] = useState<PersistedFantasyTeam[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [playerCatalogMetadata, setPlayerCatalogMetadata] =
    useState<PlayerCatalogMetadata | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [savedTeamSnapshot, setSavedTeamSnapshot] =
    useState<TeamSnapshot | null>(null);
  const [week, setWeek] = useState(1);
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>("HALF_PPR");
  const [scoringRules, setScoringRules] = useState<ScoringRules | null>(null);
  const [lineupSlots, setLineupSlots] = useState<LineupSlot[]>([
    ...DEFAULT_LINEUP_SLOTS,
  ]);
  const [savedReports, setSavedReports] = useState<SavedWeeklyReport[]>([]);
  const [viewedSavedReport, setViewedSavedReport] =
    useState<SavedWeeklyReport | null>(null);
  const [currentReportSavedId, setCurrentReportSavedId] = useState<
    string | null
  >(null);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [teamLoadError, setTeamLoadError] = useState<string | null>(null);
  const [teamSaveError, setTeamSaveError] = useState<string | null>(null);
  const [loadErrorBlocksSave, setLoadErrorBlocksSave] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
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
  const [leagueOverview, setLeagueOverview] = useState<LeagueOverview | null>(
    null,
  );
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [leagueError, setLeagueError] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const waiverRequestSequence = useRef(0);
  const leagueRequestSequence = useRef(0);

  const currentInputs = buildReportInputs(
    week,
    scoringFormat,
    scoringRules,
    lineupSlots,
    selectedPlayers,
  );
  const {
    report,
    error: recommendationError,
    loading: submitting,
    refresh: refreshLineup,
  } = useLineup(
    {
      week,
      settings: {
        scoringFormat,
        lineupSlots,
        ...(scoringRules ? { scoringRules } : {}),
      },
      rosterPlayerIds: currentInputs.rosterIds,
    },
    `${currentUser?.id ?? ""}:${teamId ?? "draft"}`,
    Boolean(currentUser) && !teamLoading,
  );
  const currentTeam = teams.find((team) => team.id === teamId) ?? null;
  const currentTeamSnapshot = buildTeamSnapshot(
    teamName,
    scoringFormat,
    scoringRules,
    lineupSlots,
    selectedPlayers,
  );
  const isTeamDirty =
    savedTeamSnapshot === null ||
    !teamSnapshotsMatch(currentTeamSnapshot, savedTeamSnapshot);
  const isReportStale = submitting;
  const persistenceStatus = getPersistenceStatus({
    teamLoading,
    savingTeam,
    teamLoadError,
    teamSaveError,
    savedTeamSnapshot,
    isTeamDirty,
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
          setAuthError(
            errorMessage(
              apiError,
              "Something went wrong checking your session.",
            ),
          );
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
        if (active)
          setReportsError(
            errorMessage(
              apiError,
              "Something went wrong loading saved reports.",
            ),
          );
      })
      .finally(() => {
        if (active) setReportsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser, teamId]);

  useEffect(() => {
    if (
      ["LINEUP", "LEAGUE", "MATCHUP"].includes(activeTab) &&
      teamId &&
      currentTeam?.sleeper &&
      !isTeamDirty &&
      !leagueOverview &&
      !leagueLoading
    ) {
      void handleLoadLeague();
    }
  }, [activeTab, teamId, currentTeam?.sleeper?.leagueId, isTeamDirty]);

  async function loadWorkspace() {
    setPlayersLoading(true);
    setTeamLoading(true);
    setPlayersError(null);
    setTeamLoadError(null);

    const [playersResult, teamsResult] = await Promise.allSettled([
      fetchPlayers(),
      fetchTeams(),
    ]);

    if (playersResult.status === "fulfilled") {
      setAvailablePlayers(playersResult.value.players);
      setPlayerCatalogMetadata(playersResult.value.metadata);

      if (
        playersResult.value.metadata.source === "LIVE" &&
        playersResult.value.metadata.week
      ) {
        setWeek(playersResult.value.metadata.week);
      }
    } else {
      setPlayersError(
        errorMessage(
          playersResult.reason,
          "Something went wrong loading players.",
        ),
      );
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
      setTeamLoadError(
        errorMessage(
          teamsResult.reason,
          "Something went wrong loading your teams.",
        ),
      );
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
        rosterPlayers,
      ),
    );
    clearReportView();
    clearWaiverView();
    clearLeagueView();
    clearAssistantView();
  }

  function resetTeamDraft() {
    setTeamId(null);
    setTeamName("");
    setScoringFormat("HALF_PPR");
    setScoringRules(null);
    setLineupSlots([...DEFAULT_LINEUP_SLOTS]);
    setSelectedPlayers([]);
    setSavedTeamSnapshot(null);
    setSavedReports([]);
    setReportsError(null);
    setViewedSavedReport(null);
    setCurrentReportSavedId(null);
    setTeamLoadError(null);
    setTeamSaveError(null);
    setLoadErrorBlocksSave(false);
    clearWaiverView();
    clearLeagueView();
    clearAssistantView();
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

  async function handleAuthenticate(
    mode: AuthMode,
    credentials: AuthCredentials,
  ) {
    if (authSubmitting) return;

    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const user =
        mode === "login"
          ? await login(credentials)
          : await register(credentials);
      setCurrentUser(user);
      await loadWorkspace();
    } catch (apiError) {
      setAuthError(
        errorMessage(
          apiError,
          mode === "login"
            ? "Could not sign in."
            : "Could not create the account.",
        ),
      );
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
    clearLeagueView();
    clearAssistantView();
    setSelectedPlayers((currentPlayers) => {
      if (
        currentPlayers.some((currentPlayer) => currentPlayer.id === player.id)
      ) {
        return currentPlayers;
      }

      return [...currentPlayers, player];
    });
  }

  function removePlayer(playerId: string) {
    setTeamSaveError(null);
    clearWaiverView();
    clearLeagueView();
    clearAssistantView();
    setSelectedPlayers((currentPlayers) =>
      currentPlayers.filter((player) => player.id !== playerId),
    );
  }

  function handleTeamNameChange(name: string) {
    setTeamName(name);
    setTeamSaveError(null);
    clearWaiverView();
    clearLeagueView();
    clearAssistantView();
  }

  function handleScoringFormatChange(nextScoringFormat: ScoringFormat) {
    setScoringFormat(nextScoringFormat);
    if (nextScoringFormat !== "CUSTOM") {
      setScoringRules(null);
    }
    setTeamSaveError(null);
    clearWaiverView();
    clearLeagueView();
    clearAssistantView();
  }

  async function handleSaveTeam() {
    if (
      savingTeam ||
      loadErrorBlocksSave ||
      teamName.trim().length === 0 ||
      !isTeamDirty
    ) {
      return;
    }

    const request: TeamWriteRequest = {
      name: teamName,
      settings: {
        scoringFormat,
        lineupSlots,
        ...(scoringRules ? { scoringRules } : {}),
      },
      rosterPlayerIds: selectedPlayers.map((player) => player.id),
    };

    setSavingTeam(true);
    setTeamSaveError(null);

    try {
      const savedTeam = teamId
        ? await updateTeam(teamId, request)
        : await createTeam(request);

      hydrateTeam(savedTeam);
      setTeams((currentTeams) => [
        savedTeam,
        ...currentTeams.filter((team) => team.id !== savedTeam.id),
      ]);
      setTeamLoadError(null);
      setLoadErrorBlocksSave(false);
    } catch (apiError) {
      setTeamSaveError(
        errorMessage(apiError, "Something went wrong saving the team."),
      );
    } finally {
      setSavingTeam(false);
    }
  }

  function handleSleeperImported(importedTeam: PersistedFantasyTeam) {
    hydrateTeam(importedTeam);
    setTeams((currentTeams) => [
      importedTeam,
      ...currentTeams.filter((team) => team.id !== importedTeam.id),
    ]);
    setTeamLoadError(null);
    setTeamSaveError(null);
    setLoadErrorBlocksSave(false);
    setActiveTab("LINEUP");
  }

  async function handleSaveReport() {
    if (
      !teamId ||
      !report ||
      isReportStale ||
      isTeamDirty ||
      savingReport ||
      viewedSavedReport
    ) {
      return;
    }

    setSavingReport(true);
    setReportsError(null);

    try {
      const savedReport = await saveWeeklyReport(teamId, { week: report.week });
      setSavedReports((currentReports) => [savedReport, ...currentReports]);
      setCurrentReportSavedId(savedReport.id);
    } catch (apiError) {
      setReportsError(
        errorMessage(apiError, "Something went wrong saving the report."),
      );
    } finally {
      setSavingReport(false);
    }
  }

  async function handleScanWaivers() {
    if (!teamId || !currentTeam?.sleeper || isTeamDirty || waiverLoading)
      return;

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
        setWaiverError(
          errorMessage(apiError, "Something went wrong scanning waivers."),
        );
      }
    } finally {
      if (waiverRequestSequence.current === requestSequence) {
        setWaiverLoading(false);
      }
    }
  }

  async function handleLoadLeague() {
    if (!teamId || !currentTeam?.sleeper || isTeamDirty || leagueLoading)
      return;

    const requestSequence = ++leagueRequestSequence.current;
    setLeagueLoading(true);
    setLeagueError(null);

    try {
      const nextOverview = await fetchLeagueOverview(teamId);

      if (leagueRequestSequence.current === requestSequence) {
        setLeagueOverview(nextOverview);
      }
    } catch (apiError) {
      if (leagueRequestSequence.current === requestSequence) {
        setLeagueError(
          errorMessage(apiError, "Something went wrong loading the league."),
        );
      }
    } finally {
      if (leagueRequestSequence.current === requestSequence) {
        setLeagueLoading(false);
      }
    }
  }

  async function handleAskAssistant(request: AssistantRequest) {
    if (!teamId || isTeamDirty || assistantLoading) {
      throw new Error("Save the current team before asking the assistant.");
    }

    setAssistantLoading(true);
    setAssistantError(null);

    try {
      return await askAssistant(teamId, request);
    } catch (apiError) {
      const messageText = errorMessage(
        apiError,
        "Something went wrong asking the assistant.",
      );
      setAssistantError(messageText);
      throw new Error(messageText);
    } finally {
      setAssistantLoading(false);
    }
  }

  function clearReportView() {
    setViewedSavedReport(null);
    setCurrentReportSavedId(null);
  }

  function clearWaiverView() {
    waiverRequestSequence.current += 1;
    setWaiverReport(null);
    setWaiverError(null);
    setWaiverLoading(false);
  }

  function clearLeagueView() {
    leagueRequestSequence.current += 1;
    setLeagueOverview(null);
    setLeagueError(null);
    setLeagueLoading(false);
  }

  function clearAssistantView() {
    setAssistantError(null);
    setAssistantLoading(false);
  }

  useEffect(() => {
    if (
      activeTab === "WAIVERS" &&
      teamId &&
      currentTeam?.sleeper &&
      !isTeamDirty &&
      !waiverReport &&
      !waiverLoading
    ) {
      void handleScanWaivers();
    }
  }, [activeTab, teamId, isTeamDirty]);

  useEffect(() => {
    if (
      !currentUser ||
      !isTeamDirty ||
      (!teamId && !teamName.trim() && !selectedPlayers.length)
    )
      return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isTeamDirty, currentUser, teamId, teamName, selectedPlayers.length]);

  function navigate(tab: WorkspaceTab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  if (authLoading || !currentUser) {
    return (
      <AuthScreen
        loading={authLoading || authSubmitting}
        error={authError}
        onSubmit={handleAuthenticate}
      />
    );
  }

  const projectedTotal = report?.starters.reduce(
    (sum, item) => sum + item.player.projectedPoints,
    0,
  );
  const unavailable = selectedPlayers.filter(
    (player) =>
      ["OUT", "IR", "SUSPENDED"].includes(player.injuryStatus) ||
      player.byeWeek === week,
  );
  const saveDisabled =
    savingTeam ||
    teamLoading ||
    loadErrorBlocksSave ||
    !teamName.trim() ||
    !isTeamDirty;
  const title =
    activeTab === "WAIVERS"
      ? "Players"
      : (NAVIGATION.find((item) => item.id === activeTab)?.label ?? "My Team");
  const teamIdentity = teamName.trim() || "New team";
  const hasDraft =
    isTeamDirty &&
    (Boolean(teamId) || Boolean(teamName.trim()) || selectedPlayers.length > 0);

  return (
    <div className="fantasy-app">
      <a className="skip-link" href="#workspace-content">
        Skip to content
      </a>
      <aside className="workspace-sidebar">
        <a
          className="product-wordmark"
          href="#team"
          onClick={(event) => {
            event.preventDefault();
            navigate("LINEUP");
          }}
        >
          <span className="wordmark-icon">
            <Shield size={21} />
          </span>
          <span>
            LINEUP<small>FANTASY ASSISTANT</small>
          </span>
        </a>
        <div className="sidebar-league">
          <span className="nav-caption">YOUR WORKSPACE</span>
          <strong>
            {leagueOverview?.league.name ??
              (currentTeam?.sleeper ? "Sleeper league" : "Fantasy football")}
          </strong>
          <small>{playerCatalogMetadata?.season ?? "NFL"} season</small>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          {NAVIGATION.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={
                activeTab === id || (id === "ROSTER" && activeTab === "WAIVERS")
                  ? "active"
                  : ""
              }
              aria-current={
                activeTab === id || (id === "ROSTER" && activeTab === "WAIVERS")
                  ? "page"
                  : undefined
              }
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "ASSISTANT" && <small>AI</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="nav-caption">SIGNED IN</span>
          <span className="user-email" title={currentUser.email}>
            {currentUser.email}
          </span>
          <button
            className="text-action"
            disabled={loggingOut}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="team-switch">
            <span className="team-avatar">
              <Shield size={21} />
            </span>
            <label>
              <span className="nav-caption">MY TEAM</span>
              <select
                aria-label="Current team"
                value={teamId ?? ""}
                disabled={savingTeam || teamLoading}
                onChange={(event) => {
                  if (
                    hasDraft &&
                    !window.confirm(
                      "Discard your unsaved roster and settings changes?",
                    )
                  )
                    return;
                  handleSelectTeam(event.target.value);
                }}
              >
                {!teamId && <option value="">{teamIdentity}</option>}
                {teams.map((team) => (
                  <option value={team.id} key={team.id}>
                    {team.id === teamId ? teamIdentity : team.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="topbar-meta">
            <span className="scoring-chip">
              {scoringFormatLabel(scoringFormat)}
            </span>
            <label className="week-picker">
              <span>Week</span>
              <select
                aria-label="NFL week"
                value={week}
                disabled={
                  playerCatalogMetadata?.source === "LIVE" || teamLoading
                }
                title={
                  playerCatalogMetadata?.source === "LIVE"
                    ? "Current projection week"
                    : "Select week"
                }
                onChange={(event) => setWeek(Number(event.target.value))}
              >
                {Array.from({ length: 18 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon-button mobile-settings"
              aria-label="Settings"
              onClick={() => navigate("TEAM")}
            >
              <Settings size={19} />
            </button>
          </div>
        </header>
        <main id="workspace-content" className="workspace-content">
          <div className="page-title-row">
            <div>
              <div className="page-breadcrumb">
                Fantasy football <ChevronRight size={12} />
                <span>{title}</span>
              </div>
              <h1>{title}</h1>
            </div>
            <span
              className={
                playerCatalogMetadata?.source === "LIVE" &&
                playerCatalogMetadata.freshness.status === "FRESH"
                  ? "data-indicator fresh"
                  : "data-indicator"
              }
            >
              <span />
              {playerCatalogMetadata?.source === "LIVE"
                ? playerCatalogMetadata.freshness.status === "FRESH"
                  ? "Projections current"
                  : "Check data freshness"
                : "Sample projections"}
            </span>
          </div>
          {teamLoadError && (
            <p className="error" role="alert">
              {teamLoadError}
            </p>
          )}
          {hasDraft && (
            <div className="draft-bar" role="status">
              <div>
                <strong>
                  {savingTeam
                    ? "Saving changes..."
                    : teamId
                      ? "Unsaved team changes"
                      : "New team draft"}
                </strong>
                <span>Changes apply to this app only.</span>
              </div>
              {!teamId && (
                <input
                  className="draft-name"
                  aria-label="New team name"
                  placeholder="Name your team"
                  value={teamName}
                  maxLength={100}
                  disabled={savingTeam}
                  onChange={(event) => handleTeamNameChange(event.target.value)}
                />
              )}
              <div>
                <button
                  className="text-action"
                  disabled={savingTeam}
                  onClick={() =>
                    currentTeam ? hydrateTeam(currentTeam) : resetTeamDraft()
                  }
                >
                  <X size={15} />
                  Discard
                </button>
                <button
                  className="primary-button"
                  disabled={saveDisabled}
                  onClick={handleSaveTeam}
                >
                  <Save size={16} />
                  {teamId ? "Save changes" : "Create team"}
                </button>
              </div>
              {teamSaveError && (
                <p className="error" role="alert">
                  {teamSaveError}
                </p>
              )}
            </div>
          )}

          <section
            hidden={activeTab !== "LINEUP"}
            aria-label="My team"
            className="view"
          >
            <div className="team-overview">
              <div className="team-overview-name">
                <span className="large-team-avatar">
                  <Shield size={30} />
                </span>
                <div>
                  <span className="eyebrow">WEEK {week}</span>
                  <h2>{teamIdentity}</h2>
                  <span>
                    {currentTeam?.sleeper
                      ? "Connected to Sleeper"
                      : "Manual roster"}{" "}
                    <span aria-hidden="true"> / </span> {selectedPlayers.length}{" "}
                    players
                  </span>
                </div>
              </div>
              <dl className="team-totals">
                <div>
                  <dt>Projected points</dt>
                  <dd>
                    {projectedTotal === undefined
                      ? "--"
                      : projectedTotal.toFixed(1)}
                  </dd>
                </div>
                <div>
                  <dt>Starters</dt>
                  <dd>
                    {report?.starters.length ?? "--"}
                    <small> / {lineupSlots.length}</small>
                  </dd>
                </div>
                <div>
                  <dt>Unavailable</dt>
                  <dd className={unavailable.length ? "warning-number" : ""}>
                    {unavailable.length}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="team-page-grid">
              <TeamLineup
                report={report}
                loading={submitting || teamLoading}
                error={recommendationError}
                week={week}
                slots={lineupSlots}
                onRefresh={refreshLineup}
                onPlayers={() => navigate("ROSTER")}
              />
              <TeamBriefing
                report={report}
                overview={leagueOverview}
                loading={leagueLoading}
                error={leagueError}
                connected={Boolean(currentTeam?.sleeper)}
                dirty={isTeamDirty}
                onMatchup={() => navigate("MATCHUP")}
                onAssistant={() => navigate("ASSISTANT")}
                onConnect={() => navigate("TEAM")}
                onLeague={() => navigate("LEAGUE")}
                onRetry={handleLoadLeague}
              />
            </div>
            {playerCatalogMetadata?.model && report && (
              <details className="advanced-section">
                <summary>
                  <Activity size={16} /> Experimental projection comparison{" "}
                  <ChevronDownIcon />
                </summary>
                <ModelPanel
                  model={playerCatalogMetadata.model}
                  report={report}
                />
              </details>
            )}
          </section>

          <section
            hidden={activeTab !== "MATCHUP"}
            className="view"
            aria-label="Matchup"
          >
            <MatchupView
              overview={leagueOverview}
              loading={leagueLoading}
              error={leagueError}
              connected={Boolean(currentTeam?.sleeper)}
              dirty={isTeamDirty}
              onRefresh={handleLoadLeague}
              onConnect={() => navigate("TEAM")}
            />
          </section>

          <section
            hidden={activeTab !== "ROSTER" && activeTab !== "WAIVERS"}
            className="view"
            aria-label="Players"
          >
            <div className="local-nav" aria-label="Player views">
              <button
                className={activeTab === "ROSTER" ? "active" : ""}
                aria-pressed={activeTab === "ROSTER"}
                onClick={() => setActiveTab("ROSTER")}
              >
                Player directory
              </button>
              <button
                className={activeTab === "WAIVERS" ? "active" : ""}
                aria-pressed={activeTab === "WAIVERS"}
                onClick={() => setActiveTab("WAIVERS")}
              >
                Waiver suggestions
              </button>
            </div>
            <div hidden={activeTab !== "ROSTER"}>
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
            </div>
            <div hidden={activeTab !== "WAIVERS"}>
              <WaiverPanel
                report={waiverReport}
                loading={waiverLoading}
                error={waiverError}
                hasSavedTeam={teamId !== null}
                connectedToSleeper={Boolean(currentTeam?.sleeper)}
                teamDirty={isTeamDirty}
                onScan={handleScanWaivers}
                onOpenTeam={() => navigate("TEAM")}
              />
            </div>
          </section>

          <section
            hidden={activeTab !== "LEAGUE"}
            className="view"
            aria-label="League"
          >
            <LeaguePanel
              overview={leagueOverview}
              loading={leagueLoading}
              error={leagueError}
              hasSavedTeam={teamId !== null}
              connectedToSleeper={Boolean(currentTeam?.sleeper)}
              teamDirty={isTeamDirty}
              scoringFormat={scoringFormat}
              scoringRules={scoringRules}
              lineupSlots={lineupSlots}
              projectionUpdatedAt={
                playerCatalogMetadata?.syncedAt ??
                playerCatalogMetadata?.updatedAt ??
                null
              }
              onRefresh={handleLoadLeague}
              onOpenTeam={() => navigate("TEAM")}
            />
          </section>

          <section
            hidden={activeTab !== "ASSISTANT"}
            className="view assistant-view"
            aria-label="Assistant"
          >
            <AssistantPanel
              key={teamId ?? "new-team"}
              hasSavedTeam={teamId !== null}
              teamDirty={isTeamDirty}
              teamName={teamName}
              loading={assistantLoading}
              error={assistantError}
              onAsk={handleAskAssistant}
              onOpenTeam={() => navigate("TEAM")}
            />
            <aside className="assistant-context-rail">
              <span className="eyebrow">TEAM CONTEXT</span>
              <h3>{teamIdentity}</h3>
              <dl>
                <div>
                  <dt>Week</dt>
                  <dd>{week}</dd>
                </div>
                <div>
                  <dt>Scoring</dt>
                  <dd>{scoringFormatLabel(scoringFormat)}</dd>
                </div>
                <div>
                  <dt>Roster</dt>
                  <dd>{selectedPlayers.length} players</dd>
                </div>
                <div>
                  <dt>League</dt>
                  <dd>
                    {currentTeam?.sleeper
                      ? "Sleeper connected"
                      : "Not connected"}
                  </dd>
                </div>
              </dl>
              <p>
                <CircleHelp size={16} /> Answers use available roster and league
                data. Check injury updates before kickoff.
              </p>
            </aside>
          </section>

          <section
            hidden={activeTab !== "TEAM"}
            className="view settings-view"
            aria-label="Settings"
          >
            <div className="mobile-account">
              <span>{currentUser.email}</span>
              <button
                className="text-action"
                disabled={loggingOut || savingTeam}
                onClick={handleLogout}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
            <div className="settings-grid">
              <div>
                <TeamControls
                  name={teamName}
                  status={persistenceStatus}
                  hasSavedTeam={teamId !== null}
                  loadError={teamLoadError}
                  saveError={teamSaveError}
                  saveDisabled={saveDisabled}
                  controlsDisabled={savingTeam}
                  teams={teams}
                  selectedTeamId={teamId}
                  onNameChange={handleTeamNameChange}
                  onSelectTeam={(id) => {
                    if (
                      !hasDraft ||
                      window.confirm("Discard your unsaved changes?")
                    )
                      handleSelectTeam(id);
                  }}
                  onNewTeam={() => {
                    if (
                      !hasDraft ||
                      window.confirm("Discard your unsaved changes?")
                    )
                      resetTeamDraft();
                  }}
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
              <SleeperImportPanel
                connection={currentTeam?.sleeper ?? null}
                disabled={savingTeam || teamLoading || hasDraft}
                onImported={handleSleeperImported}
              />
            </div>
            <details className="advanced-section">
              <summary>
                <ClipboardList size={17} /> Lineup snapshots <ChevronDownIcon />
              </summary>
              <p className="muted">
                Optional historical copies. Your current recommendations load
                automatically on My Team.
              </p>
              <button
                className="utility-button"
                disabled={
                  !report ||
                  isReportStale ||
                  isTeamDirty ||
                  !teamId ||
                  savingReport ||
                  Boolean(currentReportSavedId) ||
                  Boolean(viewedSavedReport)
                }
                onClick={handleSaveReport}
              >
                {currentReportSavedId ? (
                  <Check size={16} />
                ) : (
                  <Save size={16} />
                )}{" "}
                {savingReport
                  ? "Saving..."
                  : currentReportSavedId
                    ? "Snapshot saved"
                    : "Archive this week's snapshot"}
              </button>
              <ReportHistory
                reports={savedReports}
                loading={reportsLoading}
                error={reportsError}
                selectedReportId={viewedSavedReport?.id ?? null}
                currentReportAvailable={Boolean(report)}
                onSelect={setViewedSavedReport}
                onShowCurrent={() => setViewedSavedReport(null)}
              />
              {viewedSavedReport && (
                <ReportPanel
                  report={viewedSavedReport.report}
                  statusLabel="Archived snapshot"
                />
              )}
            </details>
          </section>
          <footer className="workspace-footer">
            <span>Lineup Assistant</span>
            <span>
              {playerCatalogMetadata?.sourceLabel ?? "Fantasy football"}
              {playerCatalogMetadata?.syncedAt
                ? ` / Updated ${new Date(playerCatalogMetadata.syncedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function ChevronDownIcon() {
  return <ChevronRight size={16} className="details-chevron" />;
}

function buildReportInputs(
  week: number,
  scoringFormat: ScoringFormat,
  scoringRules: ScoringRules | null,
  lineupSlots: LineupSlot[],
  selectedPlayers: Player[],
): ReportInputs {
  return {
    week,
    scoringFormat,
    scoringRules,
    lineupSlots: [...lineupSlots],
    rosterIds: selectedPlayers.map((player) => player.id).sort(),
  };
}

function buildTeamSnapshot(
  name: string,
  scoringFormat: ScoringFormat,
  scoringRules: ScoringRules | null,
  lineupSlots: LineupSlot[],
  selectedPlayers: Player[],
): TeamSnapshot {
  return {
    name: name.trim(),
    scoringFormat,
    scoringRules,
    lineupSlots: [...lineupSlots],
    rosterIds: selectedPlayers.map((player) => player.id).sort(),
  };
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
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function scoringRulesMatch(
  left: ScoringRules | null,
  right: ScoringRules | null,
): boolean {
  if (left === null || right === null) return left === right;

  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );

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
