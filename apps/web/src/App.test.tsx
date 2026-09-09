// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PersistedFantasyTeam, Player } from "@fantasy-football/shared";
import { App } from "./App";
import * as api from "./lib/api";

vi.mock("./lib/api");
const player: Player = {
  id: "p1",
  name: "Test Quarterback",
  position: "QB",
  nflTeam: "BUF",
  byeWeek: 7,
  injuryStatus: "HEALTHY",
  projectedPoints: 20,
};
const team: PersistedFantasyTeam = {
  id: "team-a",
  name: "Test Team",
  settings: { scoringFormat: "PPR", lineupSlots: ["QB"] },
  roster: [{ player }],
  sleeper: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  window.scrollTo = vi.fn();
  vi.mocked(api.fetchCurrentUser).mockResolvedValue({
    id: "user-a",
    email: "qa@example.test",
  });
  vi.mocked(api.fetchTeams).mockResolvedValue([structuredClone(team)]);
  vi.mocked(api.fetchWeeklyReports).mockResolvedValue([]);
  vi.mocked(api.fetchPlayers).mockResolvedValue({
    players: [player],
    metadata: {
      source: "SAMPLE",
      sourceLabel: "Test fixtures",
      season: null,
      week: null,
      updatedAt: null,
      syncedAt: null,
      freshness: {
        status: "UNAVAILABLE",
        lastSuccessfulSyncAt: null,
        lastAttemptAt: null,
        lastAttemptStatus: null,
      },
    },
  });
  vi.mocked(api.generateRecommendation).mockImplementation(async (request) => ({
    week: request.week,
    starters: request.rosterPlayerIds.length
      ? [{ slot: "QB", player, reason: "Highest projection" }]
      : [],
    bench: [],
    riskNotes: [],
    positionNeeds: [],
    summary: "Test",
  }));
});
afterEach(cleanup);

it("opens the actual team automatically and discards local roster edits without a write", async () => {
  render(<App />);
  await screen.findByRole("button", { name: "Test Quarterback, QB, details" });
  expect(api.updateTeam).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Players" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Test Quarterback from roster" }),
  );
  expect(screen.getByText("Unsaved team changes")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "My Team" }));
  expect(
    screen.queryByRole("button", { name: "Test Quarterback, QB, details" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  await screen.findByRole("button", { name: "Test Quarterback, QB, details" });
  expect(api.updateTeam).not.toHaveBeenCalled();
});

it("saves only explicitly and blocks in-flight edits until the saved team is hydrated", async () => {
  let resolveSave!: (team: PersistedFantasyTeam) => void;
  vi.mocked(api.updateTeam).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
  );
  render(<App />);
  await screen.findByRole("button", { name: "Test Quarterback, QB, details" });
  fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0]);
  fireEvent.change(screen.getByRole("textbox", { name: "Team Name" }), {
    target: { value: "Renamed Team" },
  });
  expect(api.updateTeam).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(api.updateTeam).toHaveBeenCalledWith("team-a", {
    name: "Renamed Team",
    settings: team.settings,
    rosterPlayerIds: ["p1"],
  });
  expect(
    (screen.getByRole("textbox", { name: "Team Name" }) as HTMLInputElement)
      .disabled,
  ).toBe(true);
  resolveSave({ ...team, name: "Renamed Team" });
  await waitFor(() =>
    expect(screen.queryByText("Saving changes...")).toBeNull(),
  );
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  expect(
    (screen.getByRole("textbox", { name: "Team Name" }) as HTMLInputElement)
      .value,
  ).toBe("Renamed Team");
});
