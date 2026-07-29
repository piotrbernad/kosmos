import { describe, it, expect } from "vitest";
import type { BoardCard } from "@/lib/issues/dto";
import {
  applyOptimistic,
  commitOptimistic,
  revertOptimistic,
} from "./optimisticReducer";

const baseCard = (over: Partial<BoardCard> = {}): BoardCard => ({
  id: "issue-1",
  title: "Coś nie działa",
  status: "nowe",
  createdAt: "2025-01-01T10:00:00.000Z",
  updatedAt: "2025-01-01T10:00:00.000Z",
  attachmentCount: 0,
  reporter: { id: "u-1", name: "Ola", email: "ola@example.com" },
  ...over,
});

describe("applyOptimistic", () => {
  it("adds an override with the target status without mutating the input", () => {
    const before = {};
    const after = applyOptimistic(before, baseCard(), "w_trakcie");
    expect(before).toEqual({});
    expect(after["issue-1"].status).toBe("w_trakcie");
    // Base fields carried through.
    expect(after["issue-1"].title).toBe("Coś nie działa");
  });

  it("is a no-op when the card is already at the target status", () => {
    const card = baseCard({ status: "w_trakcie" });
    const result = applyOptimistic({}, card, "w_trakcie");
    expect(result).toEqual({});
  });

  it("refuses to move a resolved card at all (Phase 5 job)", () => {
    const card = baseCard({ status: "rozwiazane" });
    const result = applyOptimistic({}, card, "w_trakcie");
    expect(result).toEqual({});
  });
});

describe("commitOptimistic", () => {
  it("replaces updatedAt with the server-truth token", () => {
    const card = baseCard({ status: "w_trakcie", updatedAt: "old" });
    const overrides = { "issue-1": card };
    const after = commitOptimistic(overrides, "issue-1", "new-token");
    expect(after["issue-1"].updatedAt).toBe("new-token");
    expect(after["issue-1"].status).toBe("w_trakcie");
    // Immutability.
    expect(overrides["issue-1"].updatedAt).toBe("old");
  });

  it("is a no-op if the id was never applied", () => {
    const before = {};
    const after = commitOptimistic(before, "nope", "new-token");
    expect(after).toEqual({});
  });
});

describe("revertOptimistic", () => {
  it("drops the override so the server row wins on the next render", () => {
    const card = baseCard({ status: "w_trakcie" });
    const before = { "issue-1": card };
    const after = revertOptimistic(before, "issue-1");
    expect(after).toEqual({});
    // Immutability.
    expect(before["issue-1"]).toBe(card);
  });

  it("is a no-op if the id was never applied", () => {
    const before = { "other": baseCard({ id: "other" }) };
    const after = revertOptimistic(before, "issue-1");
    expect(after).toBe(before);
  });
});

describe("apply → revert restores original state", () => {
  it("apply then revert leaves the map empty", () => {
    const step1 = applyOptimistic({}, baseCard(), "w_trakcie");
    const step2 = revertOptimistic(step1, "issue-1");
    expect(step2).toEqual({});
  });
});
