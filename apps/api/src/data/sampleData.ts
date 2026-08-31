import { DEFAULT_LINEUP_SLOTS, type LeagueSettings, type Player, type RosterPlayer } from "@fantasy-football/shared";

export const sampleSettings: LeagueSettings = {
  scoringFormat: "HALF_PPR",
  lineupSlots: DEFAULT_LINEUP_SLOTS
};

export const samplePlayers: Player[] = [
  {
    id: "p1",
    name: "Josh Allen",
    position: "QB",
    nflTeam: "BUF",
    byeWeek: 7,
    injuryStatus: "HEALTHY",
    projectedPoints: 22.8
  },
  {
    id: "p2",
    name: "Jahmyr Gibbs",
    position: "RB",
    nflTeam: "DET",
    byeWeek: 8,
    injuryStatus: "HEALTHY",
    projectedPoints: 17.2,
    targetShare: 0.16
  },
  {
    id: "p3",
    name: "Kyren Williams",
    position: "RB",
    nflTeam: "LAR",
    byeWeek: 10,
    injuryStatus: "QUESTIONABLE",
    projectedPoints: 14.5,
    targetShare: 0.09
  },
  {
    id: "p4",
    name: "Deebo Samuel",
    position: "WR",
    nflTeam: "WAS",
    byeWeek: 12,
    injuryStatus: "HEALTHY",
    projectedPoints: 13.6,
    targetShare: 0.21
  },
  {
    id: "p5",
    name: "Chris Olave",
    position: "WR",
    nflTeam: "NO",
    byeWeek: 11,
    injuryStatus: "HEALTHY",
    projectedPoints: 12.9,
    targetShare: 0.24
  },
  {
    id: "p6",
    name: "Trey McBride",
    position: "TE",
    nflTeam: "ARI",
    byeWeek: 8,
    injuryStatus: "HEALTHY",
    projectedPoints: 11.8,
    targetShare: 0.2
  },
  {
    id: "p7",
    name: "Brian Robinson Jr.",
    position: "RB",
    nflTeam: "SF",
    byeWeek: 14,
    injuryStatus: "HEALTHY",
    projectedPoints: 10.2,
    targetShare: 0.05
  },
  {
    id: "p8",
    name: "Brandon Aubrey",
    position: "K",
    nflTeam: "DAL",
    byeWeek: 10,
    injuryStatus: "HEALTHY",
    projectedPoints: 8.9
  },
  {
    id: "p9",
    name: "New York Jets",
    position: "DST",
    nflTeam: "NYJ",
    byeWeek: 9,
    injuryStatus: "HEALTHY",
    projectedPoints: 8.4
  },
  {
    id: "p10",
    name: "Mike Evans",
    position: "WR",
    nflTeam: "TB",
    byeWeek: 9,
    injuryStatus: "OUT",
    projectedPoints: 12.4,
    targetShare: 0.19
  },
  {
    id: "p11",
    name: "Calvin Ridley",
    position: "WR",
    nflTeam: "TEN",
    byeWeek: 10,
    injuryStatus: "HEALTHY",
    projectedPoints: 9.7,
    targetShare: 0.17
  }
];

export const sampleRoster: RosterPlayer[] = samplePlayers.map((player) => ({ player }));

