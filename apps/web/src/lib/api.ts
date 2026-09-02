import type {
  AuthCredentials,
  AuthenticatedUser,
  PersistedFantasyTeam,
  Player,
  RecommendationApiRequest,
  RecommendationReport,
  TeamWriteRequest
} from "@fantasy-football/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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

export async function fetchPlayers(): Promise<Player[]> {
  const response = await apiFetch("/api/players");

  if (!response.ok) {
    throw await buildRequestError(response, "Could not load available players.");
  }

  const payload = (await response.json()) as { players?: Player[] };

  if (!Array.isArray(payload.players)) {
    throw new Error("The players response was missing the players list.");
  }

  return payload.players;
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
