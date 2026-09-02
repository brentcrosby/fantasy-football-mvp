import assert from "node:assert/strict";
import type { Server } from "node:http";
import { once } from "node:events";
import { after, before, test } from "node:test";

import type {
  AuthenticatedUser,
  PersistedFantasyTeam,
  RecommendationReport,
  SavedWeeklyReport,
  TeamWriteRequest
} from "@fantasy-football/shared";

import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { assertTestDatabaseUrl } from "./lib/testDatabaseGuard.js";

const testNamePrefix = "[integration]";
const testEmailPrefix = "integration-test-";
const testPassword = "test-password-123";
const defaultSettings = {
  scoringFormat: "HALF_PPR" as const,
  lineupSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DST"] as const
};

let server: Server | undefined;
let baseUrl: string;
let setupFailed = false;
let defaultCookie: string;
let accountSequence = 0;

before(async () => {
  try {
    assertTestDatabaseUrl();
    await prisma.fantasyTeam.deleteMany({ where: { name: { startsWith: testNamePrefix } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: testEmailPrefix } } });

    server = app.listen(0);
    await once(server, "listening");

    const address = server.address();
    assert(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const account = await createAccount("default");
    defaultCookie = account.cookie;
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
      await prisma.user.deleteMany({ where: { email: { startsWith: testEmailPrefix } } });
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

test("requires authentication for team routes", async () => {
  const list = await apiRequest("/api/teams", { cookie: null });
  const create = await apiRequest("/api/teams", {
    method: "POST",
    body: buildTeamBody("unauthenticated", ["p1"]),
    cookie: null
  });

  assert.equal(list.status, 401);
  assert.equal(create.status, 401);
  assert.equal((await apiRequest("/api/teams/unowned/reports", { cookie: null })).status, 401);
  assert.equal(
    (await apiRequest("/api/teams/unowned/reports", { method: "POST", body: { week: 1 }, cookie: null })).status,
    401
  );
  assert.equal((await apiRequest("/api/auth/logout", { method: "POST", cookie: null })).status, 204);
});

test("registers, resumes, logs out, and logs back in", async () => {
  const email = nextTestEmail("auth-flow");
  const registration = await apiRequest("/api/auth/register", {
    method: "POST",
    body: { email: email.toUpperCase(), password: testPassword },
    cookie: null
  });

  assert.equal(registration.status, 201);
  const user = (registration.body as { user: AuthenticatedUser }).user;
  assert.equal(user.email, email);
  const cookie = readSessionCookie(registration);

  const session = await apiRequest("/api/auth/session", { cookie });
  assert.equal(session.status, 200);
  assert.deepEqual((session.body as { user: AuthenticatedUser }).user, user);

  const duplicate = await apiRequest("/api/auth/register", {
    method: "POST",
    body: { email, password: testPassword },
    cookie: null
  });
  assert.equal(duplicate.status, 409);

  const wrongPassword = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email, password: "incorrect-password" },
    cookie: null
  });
  assert.equal(wrongPassword.status, 401);

  const logoutResponse = await apiRequest("/api/auth/logout", { method: "POST", cookie });
  assert.equal(logoutResponse.status, 204);
  assert.equal((await apiRequest("/api/auth/session", { cookie })).status, 401);

  const loginResponse = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email, password: testPassword },
    cookie: null
  });
  assert.equal(loginResponse.status, 200);
  assert(readSessionCookie(loginResponse));
});

test("isolates each user's saved teams", async () => {
  const owner = await createAccount("owner");
  const otherUser = await createAccount("other");
  const createdResponse = await apiRequest("/api/teams", {
    method: "POST",
    body: buildTeamBody("owned", ["p1", "p2"]),
    cookie: owner.cookie
  });

  assert.equal(createdResponse.status, 201);
  const created = (createdResponse.body as { team: PersistedFantasyTeam }).team;

  const ownerList = await apiRequest("/api/teams", { cookie: owner.cookie });
  assert.equal(ownerList.status, 200);
  assert.equal((ownerList.body as { teams: PersistedFantasyTeam[] }).teams.some((team) => team.id === created.id), true);

  const otherList = await apiRequest("/api/teams", { cookie: otherUser.cookie });
  assert.deepEqual((otherList.body as { teams: PersistedFantasyTeam[] }).teams, []);
  assert.equal((await apiRequest(`/api/teams/${created.id}`, { cookie: otherUser.cookie })).status, 404);

  const rejectedUpdate = await apiRequest(`/api/teams/${created.id}`, {
    method: "PUT",
    body: buildTeamBody("stolen", ["p3"]),
    cookie: otherUser.cookie
  });
  assert.equal(rejectedUpdate.status, 404);

  const ownerReload = await apiRequest(`/api/teams/${created.id}`, { cookie: owner.cookie });
  assert.equal((ownerReload.body as { team: PersistedFantasyTeam }).team.name, `${testNamePrefix} owned`);
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

test("saves and lists immutable weekly report snapshots", async () => {
  const originalPlayerIds = ["p1", "p2", "p4", "p6", "p8", "p9"];
  const created = await createTeam("report snapshot", originalPlayerIds);
  const saveResponse = await apiRequest(`/api/teams/${created.id}/reports`, {
    method: "POST",
    body: { week: 7 }
  });

  assert.equal(saveResponse.status, 201);
  const saved = (saveResponse.body as { report: SavedWeeklyReport }).report;
  assert.equal(saved.fantasyTeamId, created.id);
  assert.equal(saved.teamName, `${testNamePrefix} report snapshot`);
  assert.equal(saved.week, 7);
  assert.deepEqual(saved.settings.lineupSlots, defaultSettings.lineupSlots);
  assert.deepEqual(
    saved.roster.map(({ player }) => player.id).sort(),
    [...originalPlayerIds].sort()
  );
  assert.equal(saved.report.week, 7);

  const updateResponse = await apiRequest(`/api/teams/${created.id}`, {
    method: "PUT",
    body: buildTeamBody("report snapshot updated", ["p3"])
  });
  assert.equal(updateResponse.status, 200);

  const listResponse = await apiRequest(`/api/teams/${created.id}/reports`);
  assert.equal(listResponse.status, 200);
  const listed = (listResponse.body as { reports: SavedWeeklyReport[] }).reports;
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, saved.id);
  assert.equal(listed[0].teamName, `${testNamePrefix} report snapshot`);
  assert.deepEqual(
    listed[0].roster.map(({ player }) => player.id).sort(),
    [...originalPlayerIds].sort()
  );
});

test("isolates saved reports by team owner", async () => {
  const owner = await createAccount("report-owner");
  const otherUser = await createAccount("report-other");
  const createResponse = await apiRequest("/api/teams", {
    method: "POST",
    body: buildTeamBody("private reports", ["p1", "p2"]),
    cookie: owner.cookie
  });
  const team = (createResponse.body as { team: PersistedFantasyTeam }).team;

  const ownerSave = await apiRequest(`/api/teams/${team.id}/reports`, {
    method: "POST",
    body: { week: 3 },
    cookie: owner.cookie
  });
  assert.equal(ownerSave.status, 201);

  assert.equal((await apiRequest(`/api/teams/${team.id}/reports`, { cookie: otherUser.cookie })).status, 404);
  assert.equal(
    (
      await apiRequest(`/api/teams/${team.id}/reports`, {
        method: "POST",
        body: { week: 3 },
        cookie: otherUser.cookie
      })
    ).status,
    404
  );
});

test("validates weekly report requests and rejects empty rosters", async () => {
  const team = await createTeam("report validation", ["p1"]);
  const invalidCases = [
    { week: 0 },
    { week: 19 },
    { week: 1.5 },
    { week: 1, report: { summary: "client supplied" } }
  ];

  for (const body of invalidCases) {
    const response = await apiRequest(`/api/teams/${team.id}/reports`, { method: "POST", body });
    assert.equal(response.status, 400);
  }

  const emptyTeam = await createTeam("empty report roster", []);
  const emptyRosterResponse = await apiRequest(`/api/teams/${emptyTeam.id}/reports`, {
    method: "POST",
    body: { week: 1 }
  });
  assert.equal(emptyRosterResponse.status, 422);
  assert.equal((emptyRosterResponse.body as { error: string }).error, "Add at least one player before saving a weekly report.");
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

async function createAccount(label: string): Promise<{ user: AuthenticatedUser; cookie: string }> {
  const response = await apiRequest("/api/auth/register", {
    method: "POST",
    body: { email: nextTestEmail(label), password: testPassword },
    cookie: null
  });

  assert.equal(response.status, 201);
  return {
    user: (response.body as { user: AuthenticatedUser }).user,
    cookie: readSessionCookie(response)
  };
}

function nextTestEmail(label: string): string {
  accountSequence += 1;
  return `${testEmailPrefix}${process.pid}-${accountSequence}-${label}@example.com`;
}

function readSessionCookie(response: { headers: Headers }): string {
  const setCookie = response.headers.get("set-cookie");
  assert(setCookie, "expected a session cookie");
  return setCookie.split(";", 1)[0];
}

async function apiRequest(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string | null } = {}
) {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const cookie = options.cookie === undefined ? defaultCookie : options.cookie;

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const responseText = await response.text();

  return {
    status: response.status,
    body: responseText ? (JSON.parse(responseText) as unknown) : null,
    headers: response.headers
  };
}

function numericPlayerIdSort(left: string, right: string) {
  return Number(left.slice(1)) - Number(right.slice(1));
}

function closeServer(serverToClose: Server): Promise<void> {
  return new Promise((resolve, reject) => serverToClose.close((error) => (error ? reject(error) : resolve())));
}
