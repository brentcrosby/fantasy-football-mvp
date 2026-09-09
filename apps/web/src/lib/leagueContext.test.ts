import { describe, expect, it } from "vitest";
import type { LeagueOverview, Player } from "@fantasy-football/shared";

import { buildLeagueContextText, leagueContextFilename } from "./leagueContext";

const player: Player = {
  id: "internal-player-id",
  name: "Jordan Example",
  position: "QB",
  nflTeam: "SF",
  byeWeek: 14,
  injuryStatus: "QUESTIONABLE",
  projectedPoints: 19.25
};

const overview: LeagueOverview = {
  league: { id: "private-league-id", name: "Sunday League", season: 2026, status: "in_season" },
  week: 3,
  userRosterId: 1,
  projectionSource: "Test projections",
  teams: [
    {
      rosterId: 1,
      ownerName: "Brent",
      teamName: "Fourth and Long",
      isUserTeam: true,
      record: { wins: 2, losses: 0, ties: 0 },
      pointsFor: 240.12,
      pointsAgainst: 201.8,
      projectedPoints: 101.55,
      actualPoints: 0,
      starters: [{ slot: "QB", player, reason: "Highest projected QB" }],
      bench: [],
      unmatchedPlayerCount: 1
    },
    {
      rosterId: 2,
      ownerName: "Taylor",
      teamName: "Goal Line",
      isUserTeam: false,
      record: { wins: 1, losses: 1, ties: 0 },
      pointsFor: 220,
      pointsAgainst: 219,
      projectedPoints: 98.1,
      actualPoints: null,
      starters: [],
      bench: [],
      unmatchedPlayerCount: 0
    }
  ],
  matchup: {
    matchupId: 7,
    userRosterId: 1,
    opponentRosterId: 2,
    projectedMargin: 3.45,
    positionEdges: [{ slot: "QB", userProjectedPoints: 19.25, opponentProjectedPoints: 17, advantage: "USER" }]
  },
  tradeReport: {
    week: 3,
    scoringFormat: "HALF_PPR",
    considerations: [],
    summary: "No strong trade fit.",
    modelUsed: false
  },
  alertReport: {
    week: 3,
    alerts: [],
    summary: "No recent changes."
  }
};

describe("buildLeagueContextText", () => {
  it("formats agent-ready league, matchup, standings, and roster context without internal IDs", () => {
    const text = buildLeagueContextText(overview, {
      scoringFormat: "HALF_PPR",
      scoringRules: { pass_yd: 0.04, rec: 0.5 },
      lineupSlots: ["QB", "RB", "WR", "FLEX"],
      projectionUpdatedAt: "2026-09-09T11:00:00.000Z",
      generatedAt: new Date("2026-09-09T12:00:00.000Z")
    });

    expect(text).toContain("FANTASY FOOTBALL LEAGUE CONTEXT");
    expect(text).toContain("Scoring: Half PPR");
    expect(text).toContain("Scoring rules: pass_yd=0.04, rec=0.5");
    expect(text).toContain("Projection data updated: 2026-09-09T11:00:00.000Z");
    expect(text).toContain("Fourth and Long (Brent) vs. Goal Line (Taylor)");
    expect(text).toContain("Jordan Example | QB | SF | Proj 19.3 | Status Questionable | Bye 14");
    expect(text).toContain("Unmatched Sleeper players: 1");
    expect(text).not.toContain("internal-player-id");
    expect(text).not.toContain("private-league-id");
  });
  it("identifies the favored opponent and keeps missing projections distinct from zero", () => {
    const snapshot = structuredClone(overview);
    snapshot.matchup!.projectedMargin = -4.5;
    snapshot.teams[0]!.starters[0]!.player.hasProjection = false;
    snapshot.teams[0]!.starters[0]!.player.byeWeek = 0;
    snapshot.fetchedAt = "2026-09-09T10:00:00Z";
    const text = buildLeagueContextText(snapshot, { scoringFormat: "CUSTOM", scoringRules: null, lineupSlots: ["QB"], projectionUpdatedAt: null });
    expect(text).toContain("4.5 points in favor of Goal Line");
    expect(text).toContain("Proj Unavailable");
    expect(text).toContain("Bye Unavailable");
    expect(text).toContain("Scoring rules: Unavailable");
    expect(text).toContain("League snapshot fetched: 2026-09-09T10:00:00.000Z");
  });
});

describe("leagueContextFilename", () => {
  it("creates a safe and descriptive text filename", () => {
    expect(leagueContextFilename("Brent's / Best League!", 3)).toBe("brent-s-best-league-week-3-context.txt");
  });
});
