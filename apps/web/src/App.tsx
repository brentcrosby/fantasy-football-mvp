import { useEffect, useState } from "react";
import type { RecommendationReport } from "@fantasy-football/shared";

import { ReportPanel } from "./components/ReportPanel";
import { RiskPanel } from "./components/RiskPanel";
import { fetchDemoRecommendation } from "./lib/api";

export function App() {
  const [report, setReport] = useState<RecommendationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDemoRecommendation()
      .then((nextReport) => {
        setReport(nextReport);
        setError(null);
      })
      .catch((apiError: unknown) => {
        setError(apiError instanceof Error ? apiError.message : "Something went wrong.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <header className="app-header">
        <div>
          <p className="eyebrow">Fantasy Football MVP</p>
          <h1>Lineup Assistant</h1>
          <p className="subtitle">
            Manage a roster and generate weekly starter recommendations from projections, injuries, bye weeks, and league format.
          </p>
        </div>
        <div className="header-actions">
          <span>Half PPR</span>
          <span>Week 1</span>
        </div>
      </header>

      {loading && <p className="loading">Loading recommendation report...</p>}
      {error && <p className="error">{error}</p>}

      {report && (
        <div className="dashboard-grid">
          <ReportPanel report={report} />
          <RiskPanel report={report} />
        </div>
      )}
    </main>
  );
}

