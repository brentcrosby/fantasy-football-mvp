import type { RecommendationReport } from "@fantasy-football/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function fetchDemoRecommendation(): Promise<RecommendationReport> {
  const response = await fetch(`${apiBaseUrl}/api/recommendations/demo`);

  if (!response.ok) {
    throw new Error("Could not load recommendation report.");
  }

  const payload = (await response.json()) as { report: RecommendationReport };
  return payload.report;
}

