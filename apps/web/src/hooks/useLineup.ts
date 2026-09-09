import { useEffect, useState } from "react";
import type {
  RecommendationApiRequest,
  RecommendationReport,
} from "@fantasy-football/shared";
import { generateRecommendation } from "../lib/api";

export function useLineup(
  request: RecommendationApiRequest,
  identity: string | null,
  enabled: boolean,
) {
  const key = JSON.stringify([identity, request]);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    revision: number;
    report: RecommendationReport | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled || request.rosterPlayerIds.length === 0) return;
    let active = true;
    const [, snapshot] = JSON.parse(key) as [
      string | null,
      RecommendationApiRequest,
    ];
    const timer = window.setTimeout(() => {
      void generateRecommendation(snapshot).then(
        (report) => {
          if (active) setResult({ key, revision, report, error: null });
        },
        (error) => {
          if (active)
            setResult({
              key,
              revision,
              report: null,
              error:
                error instanceof Error
                  ? error.message
                  : "Could not load your lineup.",
            });
        },
      );
    }, 200);
    // Discard responses for a previous roster, team, or session.
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [key, revision, enabled]);

  const eligible = enabled && request.rosterPlayerIds.length > 0;
  const current =
    eligible && result?.key === key && result.revision === revision
      ? result
      : null;
  return {
    report: current?.report ?? null,
    error: current?.error ?? null,
    loading: eligible && !current,
    refresh: () => setRevision((value) => value + 1),
  };
}
