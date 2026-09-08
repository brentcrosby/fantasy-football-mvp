import type {
  AuthCredentials,
  AuthenticatedUser,
  LeagueOverview,
  PersistedFantasyTeam,
  PlayerCatalog,
  RecommendationApiRequest,
  RecommendationReport,
  SavedWeeklyReport,
  SaveWeeklyReportRequest,
  SleeperImportPreview,
  SleeperImportRequest,
  SleeperLeagueLookup,
  TeamWriteRequest,
  WaiverReport
} from "@fantasy-football/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? "" : "http://localhost:4000");

export async function fetchCurrentUser(): Promise<AuthenticatedUser | null> {
  const response = await apiFetch("/api/auth/session");

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw await buildRequestError(response, "Could not check the current session.");
  }

  return readUserResponse(response);
}

export async function register(credentials: AuthCredentials): Promise<AuthenticatedUser> {
  return authenticate("/api/auth/register", credentials, "Could not create the account.");
}

export async function login(credentials: AuthCredentials): Promise<AuthenticatedUser> {
  return authenticate("/api/auth/login", credentials, "Could not sign in.");
}

export async function logout(): Promise<void> {
  const response = await apiFetch("/api/auth/logout", { method: "POST" });

  if (!response.ok) {
    throw await buildRequestError(response, "Could not sign out.");
  }
}

export async function fetchPlayers(): Promise<PlayerCatalog> {
  const response = await apiFetch("/api/players");

  if (!response.ok) {
    throw await buildRequestError(response, "Could not load available players.");
  }

  const payload = (await response.json()) as Partial<PlayerCatalog>;

  if (!Array.isArray(payload.players) || !payload.metadata) {
    throw new Error("The players response was missing catalog data.");
  }

  return { players: payload.players, metadata: payload.metadata };
}

export async function fetchTeams(): Promise<PersistedFantasyTeam[]> {
  const response = await apiFetch("/api/teams");

  if (!response.ok) {
    throw await buildRequestError(response, "Could not load your teams.");
  }

  const payload = (await response.json()) as { teams?: PersistedFantasyTeam[] };

  if (!Array.isArray(payload.teams)) {
    throw new Error("The teams response was missing the teams list.");
  }

  return payload.teams;
}

export async function fetchTeam(teamId: string): Promise<PersistedFantasyTeam> {
  const response = await apiFetch(`/api/teams/${encodeURIComponent(teamId)}`);

  if (!response.ok) {
    throw await buildRequestError(response, "Could not load the saved team.");
  }

  return readTeamResponse(response);
}

export async function createTeam(request: TeamWriteRequest): Promise<PersistedFantasyTeam> {
  return writeTeam("/api/teams", "POST", request, "Could not save the team.");
}

export async function updateTeam(teamId: string, request: TeamWriteRequest): Promise<PersistedFantasyTeam> {
  return writeTeam(`/api/teams/${encodeURIComponent(teamId)}`, "PUT", request, "Could not update the team.");
}

export async function lookupSleeperLeagues(username: string): Promise<SleeperLeagueLookup> {
  const response = await apiFetch(`/api/sleeper/leagues?username=${encodeURIComponent(username)}`);

  if (!response.ok) {
    throw await buildRequestError(response, "Could not find Sleeper leagues.");
  }

  return (await response.json()) as SleeperLeagueLookup;
}

export async function previewSleeperImport(request: SleeperImportRequest): Promise<SleeperImportPreview> {
  const response = await apiFetch("/api/sleeper/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await buildRequestError(response, "Could not preview the Sleeper team.");
  }

  const payload = (await response.json()) as { preview?: SleeperImportPreview };

  if (!payload.preview) {
    throw new Error("The Sleeper response was missing the import preview.");
  }

  return payload.preview;
}

export async function importSleeperTeam(request: SleeperImportRequest): Promise<PersistedFantasyTeam> {
  const response = await apiFetch("/api/sleeper/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await buildRequestError(response, "Could not import the Sleeper team.");
  }

  return readTeamResponse(response);
}

export async function generateRecommendation(request: RecommendationApiRequest): Promise<RecommendationReport> {
  const response = await apiFetch("/api/recommendations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await buildRequestError(response, "Could not generate a lineup recommendation.");
  }

  const payload = (await response.json()) as { report?: RecommendationReport };

  if (!payload.report) {
    throw new Error("The recommendation response was missing the report.");
  }

  return payload.report;
}

export async function fetchWaiverReport(teamId: string): Promise<WaiverReport> {
  const response = await apiFetch(`/api/teams/${encodeURIComponent(teamId)}/waivers`);

  if (!response.ok) {
    throw await buildRequestError(response, "Could not scan the Sleeper waiver wire.");
  }

  const payload = (await response.json()) as { report?: WaiverReport };

  if (!payload.report) {
    throw new Error("The waiver response was missing the report.");
  }

  return payload.report;
}

export async function fetchLeagueOverview(teamId: string): Promise<LeagueOverview> {
  const response = await apiFetch(`/api/teams/${encodeURIComponent(teamId)}/league`);

  if (!response.ok) {
    throw await buildRequestError(response, "Could not load the Sleeper league.");
  }

  const payload = (await response.json()) as { overview?: LeagueOverview };

  if (!payload.overview) {
    throw new Error("The league response was missing the overview.");
  }

  return payload.overview;
}

export async function fetchWeeklyReports(teamId: string): Promise<SavedWeeklyReport[]> {
  const response = await apiFetch(`/api/teams/${encodeURIComponent(teamId)}/reports`);

  if (!response.ok) {
    throw await buildRequestError(response, "Could not load saved reports.");
  }

  const payload = (await response.json()) as { reports?: SavedWeeklyReport[] };

  if (!Array.isArray(payload.reports)) {
    throw new Error("The saved reports response was missing the reports list.");
  }

  return payload.reports;
}

export async function saveWeeklyReport(
  teamId: string,
  request: SaveWeeklyReportRequest
): Promise<SavedWeeklyReport> {
  const response = await apiFetch(`/api/teams/${encodeURIComponent(teamId)}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await buildRequestError(response, "Could not save the weekly report.");
  }

  const payload = (await response.json()) as { report?: SavedWeeklyReport };

  if (!payload.report) {
    throw new Error("The saved report response was missing the report.");
  }

  return payload.report;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function writeTeam(path: string, method: "POST" | "PUT", request: TeamWriteRequest, fallbackMessage: string) {
  const response = await apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await buildRequestError(response, fallbackMessage);
  }

  return readTeamResponse(response);
}

async function authenticate(path: string, credentials: AuthCredentials, fallbackMessage: string): Promise<AuthenticatedUser> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  });

  if (!response.ok) {
    throw await buildRequestError(response, fallbackMessage);
  }

  return readUserResponse(response);
}

async function readUserResponse(response: Response): Promise<AuthenticatedUser> {
  const payload = (await response.json()) as { user?: AuthenticatedUser };

  if (!payload.user) {
    throw new Error("The authentication response was missing the user.");
  }

  return payload.user;
}

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, { ...init, credentials: "include" });
}

async function readTeamResponse(response: Response): Promise<PersistedFantasyTeam> {
  const payload = (await response.json()) as { team?: PersistedFantasyTeam };

  if (!payload.team) {
    throw new Error("The team response was missing the team.");
  }

  return payload.team;
}

async function buildRequestError(response: Response, fallbackMessage: string): Promise<ApiRequestError> {
  try {
    const payload = (await response.json()) as { error?: string; issues?: Array<{ message?: string }> };
    const issueMessages = payload.issues?.map((issue) => issue.message).filter(Boolean);
    const detail = issueMessages && issueMessages.length > 0 ? ` ${issueMessages.join(" ")}` : "";

    return new ApiRequestError(`${payload.error ?? fallbackMessage}${detail}`, response.status);
  } catch {
    return new ApiRequestError(`${fallbackMessage} Request failed with status ${response.status}.`, response.status);
  }
}
