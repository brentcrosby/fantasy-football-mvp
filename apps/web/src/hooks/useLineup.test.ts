// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RecommendationApiRequest,
  RecommendationReport,
} from "@fantasy-football/shared";
import { generateRecommendation } from "../lib/api";
import { useLineup } from "./useLineup";

vi.mock("../lib/api", () => ({ generateRecommendation: vi.fn() }));
const generate = vi.mocked(generateRecommendation);
const request: RecommendationApiRequest = {
  week: 1,
  settings: { scoringFormat: "PPR", lineupSlots: ["QB"] },
  rosterPlayerIds: ["p1"],
};
const report: RecommendationReport = {
  week: 1,
  starters: [],
  bench: [],
  riskNotes: [],
  positionNeeds: [],
  summary: "Test lineup",
};
const tick = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(201);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  generate.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("automatic lineup", () => {
  it("loads without a generate action and does not refetch identical input objects", async () => {
    generate.mockResolvedValue(report);
    const { result, rerender } = renderHook(
      ({ input }) => useLineup(input, "team-a", true),
      { initialProps: { input: request } },
    );
    expect(result.current.loading).toBe(true);
    await tick();
    expect(result.current.report).toEqual(report);
    rerender({ input: { ...request, settings: { ...request.settings } } });
    await tick();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("does not repeatedly retry failures; refresh explicitly retries", async () => {
    generate
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue(report);
    const { result } = renderHook(() => useLineup(request, "team-a", true));
    await tick();
    expect(result.current.error).toBe("Offline");
    expect(result.current.loading).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(generate).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    await tick();
    expect(result.current.report).toEqual(report);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("discards late responses from the previous team", async () => {
    let resolveOld!: (report: RecommendationReport) => void;
    generate
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue({ ...report, summary: "Team B" });
    const { result, rerender } = renderHook(
      ({ identity }) => useLineup(request, identity, true),
      { initialProps: { identity: "team-a" } },
    );
    await tick();
    rerender({ identity: "team-b" });
    expect(result.current.report).toBeNull();
    await tick();
    await act(async () => resolveOld(report));
    expect(result.current.report?.summary).toBe("Team B");
  });

  it("debounces rapid roster changes and hides a now-stale result immediately", async () => {
    generate.mockResolvedValue(report);
    const { result, rerender } = renderHook(
      ({ input }) => useLineup(input, "team-a", true),
      { initialProps: { input: request } },
    );
    await tick();
    rerender({ input: { ...request, rosterPlayerIds: ["p2"] } });
    expect(result.current.report).toBeNull();
    rerender({ input: { ...request, rosterPlayerIds: ["p3"] } });
    await tick();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenLastCalledWith({
      ...request,
      rosterPlayerIds: ["p3"],
    });
  });

  it("does not request a lineup while loading a team or for an empty roster", async () => {
    const { result, rerender } = renderHook(
      ({ input, enabled }) => useLineup(input, "team-a", enabled),
      { initialProps: { input: request, enabled: false } },
    );
    await tick();
    expect(result.current.loading).toBe(false);
    rerender({ input: { ...request, rosterPlayerIds: [] }, enabled: true });
    await tick();
    expect(generate).not.toHaveBeenCalled();
  });
});
