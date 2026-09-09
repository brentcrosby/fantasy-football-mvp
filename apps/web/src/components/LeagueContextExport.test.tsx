// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueOverview } from "@fantasy-football/shared";

import { LeagueContextExport } from "./LeagueContextExport";

const overview: LeagueOverview = {
  league: { id: "league-id", name: "Sunday League", season: 2026, status: "in_season" },
  week: 3,
  userRosterId: 1,
  projectionSource: "Test projections",
  teams: [],
  matchup: null,
  tradeReport: {
    week: 3,
    scoringFormat: "PPR",
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

describe("LeagueContextExport", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    writeText.mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    writeText.mockReset();
  });

  it("copies the generated league context", async () => {
    renderExport();

    fireEvent.click(screen.getByRole("button", { name: "Copy context" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]?.[0]).toContain("FANTASY FOOTBALL LEAGUE CONTEXT");
    expect(writeText.mock.calls[0]?.[0]).toContain("Name: Sunday League");
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("downloads the generated context as a descriptive text file", () => {
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:league-context");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderExport();
    fireEvent.click(screen.getByRole("button", { name: "Download .txt" }));

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:league-context");
  });
});

function renderExport() {
  render(
    <LeagueContextExport
      overview={overview}
      scoringFormat="PPR"
      scoringRules={{ rec: 1 }}
      lineupSlots={["QB", "RB", "WR", "FLEX"]}
      projectionUpdatedAt="2026-09-09T11:00:00.000Z"
    />
  );
}
