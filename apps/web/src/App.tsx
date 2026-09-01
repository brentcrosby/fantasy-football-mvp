import { useEffect, useState } from "react";
import {
  DEFAULT_LINEUP_SLOTS,
  type LineupSlot,
  type Player,
  type RecommendationReport,
  type ScoringFormat
} from "@fantasy-football/shared";

import { LeagueControls, scoringFormatLabel } from "./components/LeagueControls";
import { ReportPanel } from "./components/ReportPanel";
import { RiskPanel } from "./components/RiskPanel";
import { RosterEditor } from "./components/RosterEditor";
import { fetchPlayers, generateRecommendation } from "./lib/api";

interface ReportInputs {
  week: number;
  scoringFormat: ScoringFormat;
  rosterIds: string[];
}

export function App() {
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [week, setWeek] = useState(1);
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>("HALF_PPR");
  const [report, setReport] = useState<RecommendationReport | null>(null);
  const [reportInputs, setReportInputs] = useState<ReportInputs | null>(null);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const currentInputs = buildReportInputs(week, scoringFormat, selectedPlayers);
  const isReportStale = report !== null && reportInputs !== null && !inputsMatch(currentInputs, reportInputs);
  const unfilledSlots = report ? findUnfilledSlots(DEFAULT_LINEUP_SLOTS, report.starters.map((assignment) => assignment.slot)) : [];

  useEffect(() => {
    fetchPlayers()
      .then((players) => {
        setAvailablePlayers(players);
        setPlayersError(null);
      })
      .catch((apiError: unknown) => {
        setPlayersError(apiError instanceof Error ? apiError.message : "Something went wrong loading players.");
      })
      .finally(() => setPlayersLoading(false));
  }, []);

  function addPlayer(player: Player) {
    setSelectedPlayers((currentPlayers) => {
      if (currentPlayers.some((currentPlayer) => currentPlayer.id === player.id)) {
        return currentPlayers;
      }

      return [...currentPlayers, player];
    });
  }

  function removePlayer(playerId: string) {
    setSelectedPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== playerId));
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
        settings: {
          scoringFormat,
          lineupSlots: DEFAULT_LINEUP_SLOTS
        },
        roster: selectedPlayers.map((player) => ({ player }))
      });

      setReport(nextReport);
      setReportInputs(currentInputs);
    } catch (apiError) {
      setRecommendationError(apiError instanceof Error ? apiError.message : "Something went wrong generating a lineup.");
    } finally {
      setSubmitting(false);
    }
  }

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
          <span>{scoringFormatLabel(scoringFormat)}</span>
          <span>Week {week}</span>
        </div>
      </header>

      <div className="workflow-grid">
        <div className="workflow-main">
          <LeagueControls
            week={week}
            scoringFormat={scoringFormat}
            onWeekChange={setWeek}
            onScoringFormatChange={setScoringFormat}
          />
          <RosterEditor
            players={availablePlayers}
            selectedPlayers={selectedPlayers}
            onAddPlayer={addPlayer}
            onRemovePlayer={removePlayer}
            loading={playersLoading}
            error={playersError}
          />
        </div>

        <aside className="panel generate-panel" aria-labelledby="generate-heading">
          <div className="section-header">
            <div>
              <p className="eyebrow">Recommendation</p>
              <h2 id="generate-heading">Lineup</h2>
            </div>
          </div>

          <div className="generate-body">
            {selectedPlayers.length === 0 && <p className="state-message">Select at least one player to generate a lineup.</p>}
            {recommendationError && <p className="error inline-error">{recommendationError}</p>}
            {isReportStale && <p className="stale-message">This report is stale. Generate a new lineup to use the current roster and settings.</p>}

            <button className="generate-button" type="button" disabled={selectedPlayers.length === 0 || submitting} onClick={handleGenerateLineup}>
              {submitting ? "Generating..." : "Generate Lineup"}
            </button>
          </div>
        </aside>
      </div>

      {report && (
        <>
          {unfilledSlots.length > 0 && (
            <section className="warning-panel" aria-live="polite">
              <strong>Unfilled lineup positions:</strong> {unfilledSlots.join(", ")}
            </section>
          )}

          <div className="dashboard-grid">
            <ReportPanel report={report} />
            <RiskPanel report={report} />
          </div>
        </>
      )}
    </main>
  );
}

function buildReportInputs(week: number, scoringFormat: ScoringFormat, selectedPlayers: Player[]): ReportInputs {
  return {
    week,
    scoringFormat,
    rosterIds: selectedPlayers.map((player) => player.id).sort()
  };
}

function inputsMatch(left: ReportInputs, right: ReportInputs): boolean {
  return (
    left.week === right.week &&
    left.scoringFormat === right.scoringFormat &&
    left.rosterIds.length === right.rosterIds.length &&
    left.rosterIds.every((playerId, index) => playerId === right.rosterIds[index])
  );
}

function findUnfilledSlots(expectedSlots: LineupSlot[], starterSlots: LineupSlot[]): string[] {
  const expectedCounts = countSlots(expectedSlots);
  const starterCounts = countSlots(starterSlots);

  return Object.entries(expectedCounts)
    .flatMap(([slot, expectedCount]) => {
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
