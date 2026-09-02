import type {
  PersistedFantasyTeam,
  Player,
  RecommendationApiRequest,
  RecommendationReport,
  TeamWriteRequest
} from "@fantasy-football/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function fetchPlayers(): Promise<Player[]> {
  const response = await fetch(`${apiBaseUrl}/api/players`);

  if (!response.ok) {
    throw await buildRequestError(response, "Could not load available players.");
  }

  const payload = (await response.json()) as { players?: Player[] };

  if (!Array.isArray(payload.players)) {
    throw new Error("The players response was missing the players list.");
  }

  return payload.players;
}

export async function fetchTeam(teamId: string): Promise<PersistedFantasyTeam> {
  const response = await fetch(`${apiBaseUrl}/api/teams/${encodeURIComponent(teamId)}`);

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
  const response = await fetch(`${apiBaseUrl}/api/recommendations`, {
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
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await buildRequestError(response, fallbackMessage);
  }

  return readTeamResponse(response);
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
