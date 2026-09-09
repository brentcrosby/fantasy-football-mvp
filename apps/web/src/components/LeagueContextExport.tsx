import { useEffect, useMemo, useState } from "react";
import type { LeagueOverview, ScoringFormat, ScoringRules } from "@fantasy-football/shared";
import { Check, Copy, Download } from "lucide-react";

import { buildLeagueContextText, leagueContextFilename } from "../lib/leagueContext";

interface LeagueContextExportProps {
  overview: LeagueOverview;
  scoringFormat: ScoringFormat;
  scoringRules: ScoringRules | null;
  lineupSlots: string[];
  projectionUpdatedAt: string | null;
}

type CopyStatus = "IDLE" | "COPIED" | "ERROR";

export function LeagueContextExport({
  overview,
  scoringFormat,
  scoringRules,
  lineupSlots,
  projectionUpdatedAt
}: LeagueContextExportProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("IDLE");
  const contextText = useMemo(
    () => buildLeagueContextText(overview, { scoringFormat, scoringRules, lineupSlots, projectionUpdatedAt }),
    [overview, scoringFormat, scoringRules, lineupSlots, projectionUpdatedAt]
  );

  useEffect(() => {
    setCopyStatus("IDLE");
  }, [contextText]);

  async function copyContext() {
    try {
      await navigator.clipboard.writeText(contextText);
      setCopyStatus("COPIED");
    } catch {
      setCopyStatus("ERROR");
    }
  }

  function downloadContext() {
    const blob = new Blob([contextText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = leagueContextFilename(overview.league.name, overview.week);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="league-context-export" aria-labelledby="league-context-heading">
      <div className="context-export-header">
        <div>
          <p className="eyebrow">Agent-ready data</p>
          <h3 id="league-context-heading">League Context Export</h3>
          <p>
            Copy your current league into ChatGPT, Claude, Gemini, or another assistant without taking screenshots.
          </p>
        </div>
        <div className="context-export-actions">
          <button className="utility-button" type="button" onClick={() => void copyContext()}>
            {copyStatus === "COPIED" ? <Check size={15} /> : <Copy size={15} />}
            {copyStatus === "COPIED" ? "Copied" : "Copy context"}
          </button>
          <button className="utility-button" type="button" onClick={downloadContext}>
            <Download size={15} />
            Download .txt
          </button>
        </div>
      </div>

      <div className="context-export-meta" aria-label="Export details">
        <span>{overview.teams.length} teams</span>
        <span>Week {overview.week}</span>
        <span>{contextText.length.toLocaleString()} characters</span>
      </div>

      <textarea
        className="context-export-preview"
        aria-label="League context text"
        readOnly
        spellCheck={false}
        value={contextText}
      />

      {copyStatus === "ERROR" && (
        <p className="error context-export-error">
          Clipboard access was blocked. Select the preview text and copy it manually, or download the file.
        </p>
      )}
      <p className="trade-disclosure">
        This export contains league and roster information only. It does not include your email, password, session, or database IDs.
      </p>
    </section>
  );
}
