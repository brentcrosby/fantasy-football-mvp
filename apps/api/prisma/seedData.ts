import type { InjuryStatus, PlayerDataSource, Position } from "@prisma/client";

export interface SeedPlayer {
  id: string;
  name: string;
  position: Position;
  nflTeam: string;
  byeWeek: number;
  injuryStatus: InjuryStatus;
  projectedPoints: number;
  projectionSource: string;
  targetShare: number | null;
  dataSource: PlayerDataSource;
}

export const seedPlayers: SeedPlayer[] = [
  {
    id: "p1",
    name: "Josh Allen",
    position: "QB",
    nflTeam: "BUF",
    byeWeek: 7,
    injuryStatus: "HEALTHY",
    projectedPoints: 22.8,
    projectionSource: "Sample projection data",
    targetShare: null,
    dataSource: "SEED"
  },
  {
    id: "p2",
    name: "Jahmyr Gibbs",
    position: "RB",
    nflTeam: "DET",
    byeWeek: 8,
    injuryStatus: "HEALTHY",
    projectedPoints: 17.2,
    projectionSource: "Sample projection data",
    targetShare: 0.16,
    dataSource: "SEED"
  },
  {
    id: "p3",
    name: "Kyren Williams",
    position: "RB",
    nflTeam: "LAR",
    byeWeek: 10,
    injuryStatus: "QUESTIONABLE",
    projectedPoints: 14.5,
    projectionSource: "Sample projection data",
    targetShare: 0.09,
    dataSource: "SEED"
  },
  {
    id: "p4",
    name: "Deebo Samuel",
    position: "WR",
    nflTeam: "WAS",
    byeWeek: 12,
    injuryStatus: "HEALTHY",
    projectedPoints: 13.6,
    projectionSource: "Sample projection data",
    targetShare: 0.21,
    dataSource: "SEED"
  },
  {
    id: "p5",
    name: "Chris Olave",
    position: "WR",
    nflTeam: "NO",
    byeWeek: 11,
    injuryStatus: "HEALTHY",
    projectedPoints: 12.9,
    projectionSource: "Sample projection data",
    targetShare: 0.24,
    dataSource: "SEED"
  },
  {
    id: "p6",
    name: "Trey McBride",
    position: "TE",
    nflTeam: "ARI",
    byeWeek: 8,
    injuryStatus: "HEALTHY",
    projectedPoints: 11.8,
    projectionSource: "Sample projection data",
    targetShare: 0.2,
    dataSource: "SEED"
  },
  {
    id: "p7",
    name: "Brian Robinson Jr.",
    position: "RB",
    nflTeam: "SF",
    byeWeek: 14,
    injuryStatus: "HEALTHY",
    projectedPoints: 10.2,
    projectionSource: "Sample projection data",
    targetShare: 0.05,
    dataSource: "SEED"
  },
  {
    id: "p8",
    name: "Brandon Aubrey",
    position: "K",
    nflTeam: "DAL",
    byeWeek: 10,
    injuryStatus: "HEALTHY",
    projectedPoints: 8.9,
    projectionSource: "Sample projection data",
    targetShare: null,
    dataSource: "SEED"
  },
  {
    id: "p9",
    name: "New York Jets",
    position: "DST",
    nflTeam: "NYJ",
    byeWeek: 9,
    injuryStatus: "HEALTHY",
    projectedPoints: 8.4,
    projectionSource: "Sample projection data",
    targetShare: null,
    dataSource: "SEED"
  },
  {
    id: "p10",
    name: "Mike Evans",
    position: "WR",
    nflTeam: "TB",
    byeWeek: 9,
    injuryStatus: "OUT",
    projectedPoints: 12.4,
    projectionSource: "Sample projection data",
    targetShare: 0.19,
    dataSource: "SEED"
  },
  {
    id: "p11",
    name: "Calvin Ridley",
    position: "WR",
    nflTeam: "TEN",
    byeWeek: 10,
    injuryStatus: "HEALTHY",
    projectedPoints: 9.7,
    projectionSource: "Sample projection data",
    targetShare: 0.17,
    dataSource: "SEED"
  }
];
