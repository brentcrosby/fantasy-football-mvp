import type { Player, RecommendationReport, RecommendationRequest } from "@fantasy-football/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function fetchPlayers(): Promise<Player[]> {
  const response = await fetch(`${apiBaseUrl}/api/players`);

  if (!response.ok) {
    throw new Error(await buildRequestError(response, "Could not load available players."));
  }

  const payload = (await response.json()) as { players?: Player[] };

  if (!Array.isArray(payload.players)) {
    throw new Error("The players response was missing the players list.");
  }

  return payload.players;
}

export async function generateRecommendation(request: RecommendationRequest): Promise<RecommendationReport> {
  const response = await fetch(`${apiBaseUrl}/api/recommendations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(await buildRequestError(response, "Could not generate a lineup recommendation."));
  }

  const payload = (await response.json()) as { report?: RecommendationReport };

  if (!payload.report) {
    throw new Error("The recommendation response was missing the report.");
  }

  return payload.report;
}

async function buildRequestError(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string; issues?: Array<{ message?: string }> };
    const issueMessages = payload.issues?.map((issue) => issue.message).filter(Boolean);
    const detail = issueMessages && issueMessages.length > 0 ? ` ${issueMessages.join(" ")}` : "";

    return `${payload.error ?? fallbackMessage}${detail}`;
  } catch {
    return `${fallbackMessage} Request failed with status ${response.status}.`;
  }
}
