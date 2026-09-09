import {
  buildLineupRecommendation,
  defaultScoringRules,
  type LeagueOverview,
  type LeagueSettings,
  type Player,
  type Position
} from "@fantasy-football/shared";

export const demoSettings: LeagueSettings = {
  scoringFormat: "PPR",
  scoringRules: defaultScoringRules("PPR"),
  lineupSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DST"]
};
export const demoTimestamp = "2026-09-09T12:00:00.000Z";
const positions: Position[] = [
  "QB",
  "RB",
  "RB",
  "WR",
  "WR",
  "TE",
  "WR",
  "K",
  "DST",
  "RB",
  "WR",
  "TE",
  "QB"
];
const names = [
  "Alex Carter",
  "Marcus Reed",
  "Jordan Brooks",
  "Devin Hayes",
  "Evan Cole",
  "Noah Grant",
  "Miles Parker",
  "Owen Lane",
  "Sample Defense",
  "Theo Bennett",
  "Jules Morgan",
  "Sam Ellis",
  "Drew Foster"
];
const teamNames = ["Fourth & Goal", "Sunday Standard", "Red Zone Club", "West Coast Drive"];

// Synthetic fixtures, deliberately independent of real accounts and provider data.
export function buildSampleLeague(injured = false) {
  const reports = teamNames.map((_, teamIndex) => {
    const roster = positions.map((position, index): { player: Player } => ({
      player: {
        id: `demo-${teamIndex}-${index}`,
        name:
          teamIndex === 0
            ? names[index]!
            : `${["Casey", "Riley", "Morgan"][teamIndex - 1]} ${names[index]!.split(" ").at(-1)}`,
        position,
        nflTeam: ["SF", "BUF", "DET", "PHI"][teamIndex]!,
        byeWeek: index === 10 ? 4 : 8 + teamIndex,
        injuryStatus:
          teamIndex === 0 && index === 0 && injured
            ? "OUT"
            : index === 9
              ? "QUESTIONABLE"
              : "HEALTHY",
        projectedPoints:
          [24, 18, 15, 21, 17, 12, 14, 8, 7, 11, 10, 8, 16][index]! + teamIndex * 0.4,
        hasProjection: true,
        projectionSource: "Synthetic demo fixtures",
        projectionMethod: "PROVIDER_TOTAL"
      }
    }));
    return buildLineupRecommendation({ week: 4, settings: demoSettings, roster });
  });
  const teams = teamNames.map((teamName, i) => ({
    rosterId: i + 1,
    teamName,
    ownerName: `Sample manager ${i + 1}`,
    isUserTeam: i === 0,
    record: { wins: 3 - i, losses: i, ties: 0 },
    pointsFor: 410 - i * 15,
    pointsAgainst: 330 + i * 12,
    projectedPoints: Number(
      reports[i]!.starters.reduce((sum, { player }) => sum + player.projectedPoints, 0).toFixed(1)
    ),
    actualPoints: null,
    starters: reports[i]!.starters,
    bench: reports[i]!.bench,
    unmatchedPlayerCount: 0
  }));
  const yours = teams[0]!;
  const opponent = teams[1]!;
  const overview: LeagueOverview = {
    league: {
      id: "sample-league",
      name: "Sunday Sample League",
      season: 2026,
      status: "sample_data"
    },
    week: 4,
    userRosterId: 1,
    teams,
    projectionSource: "Synthetic demo fixtures",
    matchup: {
      matchupId: 1,
      userRosterId: 1,
      opponentRosterId: 2,
      projectedMargin: Number((yours.projectedPoints - opponent.projectedPoints).toFixed(1)),
      positionEdges: [...new Set(demoSettings.lineupSlots)].map((slot) => {
        const total = (index: number) =>
          reports[index]!.starters.filter((s) => s.slot === slot).reduce(
            (sum, s) => sum + s.player.projectedPoints,
            0
          );
        const userProjectedPoints = total(0);
        const opponentProjectedPoints = total(1);
        return {
          slot,
          userProjectedPoints,
          opponentProjectedPoints,
          advantage:
            userProjectedPoints > opponentProjectedPoints
              ? "USER"
              : userProjectedPoints < opponentProjectedPoints
                ? "OPPONENT"
                : "EVEN"
        };
      })
    },
    tradeReport: {
      week: 4,
      scoringFormat: "PPR",
      considerations: [],
      summary: "No trade signals in this sample snapshot.",
      modelUsed: false
    },
    alertReport: { week: 4, alerts: [], summary: "No historical alerts in this sample snapshot." }
  };
  return { overview, report: reports[0]! };
}
