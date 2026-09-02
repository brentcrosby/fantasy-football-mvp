import assert from "node:assert/strict";
import type { Server } from "node:http";
import { once } from "node:events";
import { after, before, test } from "node:test";

import type { PersistedFantasyTeam, RecommendationReport, TeamWriteRequest } from "@fantasy-football/shared";

import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { assertTestDatabaseUrl } from "./lib/testDatabaseGuard.js";

const testNamePrefix = "[integration]";
const defaultSettings = {
  scoringFormat: "HALF_PPR" as const,
  lineupSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DST"] as const
};

let server: Server | undefined;
let baseUrl: string;
let setupFailed = false;

before(async () => {
  try {
    assertTestDatabaseUrl();
    await prisma.fantasyTeam.deleteMany({ where: { name: { startsWith: testNamePrefix } } });

    server = app.listen(0);
    await once(server, "listening");

    const address = server.address();
    assert(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;
  } catch (error) {
    setupFailed = true;
    throw error;
  }
});

after(async () => {
  const teardownErrors: unknown[] = [];

  if (!setupFailed) {
    try {
      assertTestDatabaseUrl();
      await prisma.fantasyTeam.deleteMany({ where: { name: { startsWith: testNamePrefix } } });
    } catch (error) {
      teardownErrors.push(error);
    }
  }

  if (server) {
    try {
      await closeServer(server);
    } catch (error) {
      teardownErrors.push(error);
    }
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    teardownErrors.push(error);
  }

  if (setupFailed) {
    teardownErrors.forEach((error) => console.error("Test teardown failed after setup failure.", error));
    return;
  }

  teardownErrors.slice(1).forEach((error) => console.error("Additional test teardown failure.", error));

  if (teardownErrors[0]) {
    throw teardownErrors[0];
  }
});

test("lists the stable seeded player catalog from PostgreSQL", async () => {
  const response = await apiRequest("/api/players");

  assert.equal(response.status, 200);
  const players = (response.body as { players: Array<{ id: string }> }).players;
  const seededIds = players.map((player) => player.id).filter((id) => /^p(?:[1-9]|10|11)$/.test(id));

  assert.deepEqual(seededIds.sort(numericPlayerIdSort), ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"]);
});

test("creates and loads a team with ordered settings and roster membership", async () => {
  const created = await createTeam("round trip", ["p1", "p2", "p4"]);
  const response = await apiRequest(`/api/teams/${created.id}`);

  assert.equal(response.status, 200);
  const loaded = (response.body as { team: PersistedFantasyTeam }).team;
  assert.equal(loaded.name, `${testNamePrefix} round trip`);
  assert.deepEqual(loaded.settings.lineupSlots, defaultSettings.lineupSlots);
  assert.deepEqual(
    loaded.roster.map(({ player }) => player.id).sort(),
    ["p1", "p2", "p4"]
  );
});

test("rejects malformed team requests and duplicate player IDs", async () => {
  const malformed = await apiRequest("/api/teams", {
    method: "POST",
    body: { name: " ", settings: defaultSettings, rosterPlayerIds: [] }
  });
  const duplicate = await apiRequest("/api/teams", {
    method: "POST",
    body: { name: `${testNamePrefix} duplicate`, settings: defaultSettings, rosterPlayerIds: ["p1", "p1"] }
  });

  assert.equal(malformed.status, 400);
  assert.equal(duplicate.status, 400);
});

test("rejects invalid team settings, extra fields, and excessive arrays", async () => {
  const validBody = buildTeamBody("validation", ["p1"]);
  const cases: Array<{ name: string; body: unknown }> = [
    {
      name: "unknown scoring format",
      body: { ...validBody, settings: { ...validBody.settings, scoringFormat: "BONUS_PPR" } }
    },
    {
      name: "empty lineup slots",
      body: { ...validBody, settings: { ...validBody.settings, lineupSlots: [] } }
    },
    {
      name: "invalid lineup slot",
      body: { ...validBody, settings: { ...validBody.settings, lineupSlots: ["QB", "SUPERFLEX"] } }
    },
    {
      name: "excessive lineup slots",
      body: { ...validBody, settings: { ...validBody.settings, lineupSlots: Array.from({ length: 31 }, () => "QB") } }
    },
    {
      name: "unexpected extra field",
      body: { ...validBody, unexpected: true }
    },
    {
      name: "excessive roster",
      body: { ...validBody, rosterPlayerIds: Array.from({ length: 31 }, (_value, index) => `player-${index}`) }
    }
  ];

  for (const testCase of cases) {
    const response = await apiRequest("/api/teams", { method: "POST", body: testCase.body });
    assert.equal(response.status, 400, testCase.name);
  }
});

test("replaces a roster atomically and preserves it when a player is unknown", async () => {
  const created = await createTeam("replacement", ["p1", "p2"]);
  const replacementBody = buildTeamBody("replacement updated", ["p3", "p4", "p5"]);
  const replaced = await apiRequest(`/api/teams/${created.id}`, { method: "PUT", body: replacementBody });

  assert.equal(replaced.status, 200);
  assert.deepEqual(
    (replaced.body as { team: PersistedFantasyTeam }).team.roster.map(({ player }) => player.id).sort(),
    ["p3", "p4", "p5"]
  );

  const rejected = await apiRequest(`/api/teams/${created.id}`, {
    method: "PUT",
    body: buildTeamBody("must not persist", ["p1", "missing-player"])
  });
  assert.equal(rejected.status, 422);
  assert.deepEqual((rejected.body as { unknownPlayerIds: string[] }).unknownPlayerIds, ["missing-player"]);

  const loaded = await apiRequest(`/api/teams/${created.id}`);
  const unchangedTeam = (loaded.body as { team: PersistedFantasyTeam }).team;
  assert.equal(unchangedTeam.name, `${testNamePrefix} replacement updated`);
  assert.deepEqual(
    unchangedTeam.roster.map(({ player }) => player.id).sort(),
    ["p3", "p4", "p5"]
  );
});

test("rejects duplicate IDs on PUT without changing the team", async () => {
  const created = await createTeam("duplicate update", ["p1", "p2"]);
  const rejected = await apiRequest(`/api/teams/${created.id}`, {
    method: "PUT",
    body: buildTeamBody("duplicate update changed", ["p3", "p3"])
  });

  assert.equal(rejected.status, 400);

  const loaded = await apiRequest(`/api/teams/${created.id}`);
  const unchangedTeam = (loaded.body as { team: PersistedFantasyTeam }).team;
  assert.equal(unchangedTeam.name, `${testNamePrefix} duplicate update`);
  assert.deepEqual(
    unchangedTeam.roster.map(({ player }) => player.id).sort(),
    ["p1", "p2"]
  );
});

test("returns 404 for missing teams", async () => {
  const loaded = await apiRequest("/api/teams/missing-team");
  const updated = await apiRequest("/api/teams/missing-team", {
    method: "PUT",
    body: buildTeamBody("missing", ["p1"])
  });

  assert.equal(loaded.status, 404);
  assert.equal(updated.status, 404);
});

test("allows an empty saved roster while recommendations require players", async () => {
  const created = await createTeam("empty roster", []);
  assert.deepEqual(created.roster, []);

  const recommendation = await apiRequest("/api/recommendations", {
    method: "POST",
    body: { week: 1, settings: defaultSettings, rosterPlayerIds: [] }
  });
  assert.equal(recommendation.status, 400);

  const duplicateRecommendation = await apiRequest("/api/recommendations", {
    method: "POST",
    body: { week: 1, settings: defaultSettings, rosterPlayerIds: ["p1", "p1"] }
  });
  assert.equal(duplicateRecommendation.status, 400);
});

test("loads canonical players for recommendations and reports unknown IDs", async () => {
  const recommendation = await apiRequest("/api/recommendations", {
    method: "POST",
    body: { week: 1, settings: defaultSettings, rosterPlayerIds: ["p1", "p2", "p4", "p6", "p8", "p9"] }
  });

  assert.equal(recommendation.status, 200);
  const report = (recommendation.body as { report: RecommendationReport }).report;
  assert.equal(report.week, 1);
  assert(report.starters.some(({ player }) => player.id === "p1" && player.projectedPoints === 22.8));

  const unknown = await apiRequest("/api/recommendations", {
    method: "POST",
    body: { week: 1, settings: defaultSettings, rosterPlayerIds: ["p1", "not-real"] }
  });
  assert.equal(unknown.status, 422);
  assert.deepEqual((unknown.body as { unknownPlayerIds: string[] }).unknownPlayerIds, ["not-real"]);

  const clientPlayerPayload = await apiRequest("/api/recommendations", {
    method: "POST",
    body: {
      week: 1,
      settings: defaultSettings,
      rosterPlayerIds: ["p1"],
      roster: [{ player: { id: "p1", projectedPoints: 999 } }]
    }
  });
  assert.equal(clientPlayerPayload.status, 400);
});

test("canonical recommendations exclude OUT and bye-week players from starters", async () => {
  const recommendation = await apiRequest("/api/recommendations", {
    method: "POST",
    body: { week: 7, settings: defaultSettings, rosterPlayerIds: ["p1", "p2", "p4", "p6", "p8", "p9", "p10"] }
  });

  assert.equal(recommendation.status, 200);
  const report = (recommendation.body as { report: RecommendationReport }).report;
  const starterIds = new Set(report.starters.map(({ player }) => player.id));

  assert.equal(starterIds.has("p1"), false, "bye-week player should not start");
  assert.equal(starterIds.has("p10"), false, "OUT player should not start");
});

async function createTeam(name: string, rosterPlayerIds: string[]): Promise<PersistedFantasyTeam> {
  const response = await apiRequest("/api/teams", { method: "POST", body: buildTeamBody(name, rosterPlayerIds) });

  assert.equal(response.status, 201);
  return (response.body as { team: PersistedFantasyTeam }).team;
}

function buildTeamBody(name: string, rosterPlayerIds: string[]): TeamWriteRequest {
  return {
    name: `${testNamePrefix} ${name}`,
    settings: {
      scoringFormat: defaultSettings.scoringFormat,
      lineupSlots: [...defaultSettings.lineupSlots]
    },
    rosterPlayerIds
  };
}

async function apiRequest(path: string, options: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  return { status: response.status, body: (await response.json()) as unknown };
}

function numericPlayerIdSort(left: string, right: string) {
  return Number(left.slice(1)) - Number(right.slice(1));
}

function closeServer(serverToClose: Server): Promise<void> {
  return new Promise((resolve, reject) => serverToClose.close((error) => (error ? reject(error) : resolve())));
}
