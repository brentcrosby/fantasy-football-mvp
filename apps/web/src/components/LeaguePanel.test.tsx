// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSampleLeague, demoSettings, demoTimestamp } from "../demo/sampleLeague";
import { LeaguePanel } from "./LeaguePanel";

afterEach(cleanup);

describe("league export freshness", () => {
  const props = {
    overview: buildSampleLeague(false).overview,
    loading: false,
    error: null,
    hasSavedTeam: true,
    connectedToSleeper: true,
    teamDirty: false,
    scoringFormat: demoSettings.scoringFormat,
    scoringRules: demoSettings.scoringRules!,
    lineupSlots: demoSettings.lineupSlots,
    projectionUpdatedAt: demoTimestamp,
    onRefresh: vi.fn(),
    onOpenTeam: vi.fn()
  };

  it.each([
    { teamDirty: true, loading: false, error: null },
    { teamDirty: false, loading: true, error: null },
    { teamDirty: false, loading: false, error: "Provider unavailable" }
  ])("blocks old context while the league is not ready: %j", (state) => {
    const { rerender } = render(<LeaguePanel {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "Context export" }));
    expect(screen.getByRole("button", { name: "Copy context" })).toBeTruthy();

    rerender(<LeaguePanel {...props} {...state} />);
    expect(screen.queryByRole("button", { name: "Copy context" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Download .txt" })).toBeNull();

    rerender(<LeaguePanel {...props} />);
    expect(screen.getByRole("button", { name: "Copy context" })).toBeTruthy();
  });
});
