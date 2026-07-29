import { describe, it, expect } from "vitest";
import {
  AddCommentSchema,
  ChangeStatusSchema,
  CreateIssueSchema,
  EventPayloadSchema,
  IssueIdSchema,
} from "./validators";

describe("CreateIssueSchema", () => {
  it("accepts a valid title + description", () => {
    const result = CreateIssueSchema.safeParse({
      title: "Coś jest zepsute",
      description: "Kliknąłem X i pojawił się błąd.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Coś jest zepsute");
    }
  });

  it("trims whitespace before length checks", () => {
    const result = CreateIssueSchema.safeParse({
      title: "   ok tytuł   ",
      description: "   x   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("ok tytuł");
      expect(result.data.description).toBe("x");
    }
  });

  it("rejects an all-whitespace title (becomes empty after trim)", () => {
    const result = CreateIssueSchema.safeParse({
      title: "     ",
      description: "opis",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title below the 3-char floor", () => {
    const result = CreateIssueSchema.safeParse({
      title: "ab",
      description: "opis",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title above the 200-char ceiling", () => {
    const result = CreateIssueSchema.safeParse({
      title: "a".repeat(201),
      description: "opis",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 200-char title on the exact boundary", () => {
    const result = CreateIssueSchema.safeParse({
      title: "a".repeat(200),
      description: "opis",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty description", () => {
    const result = CreateIssueSchema.safeParse({
      title: "tytuł",
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a description above the 5000-char ceiling", () => {
    const result = CreateIssueSchema.safeParse({
      title: "tytuł",
      description: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(CreateIssueSchema.safeParse({}).success).toBe(false);
    expect(CreateIssueSchema.safeParse({ title: "tytuł" }).success).toBe(false);
    expect(CreateIssueSchema.safeParse({ description: "opis" }).success).toBe(false);
  });

  it("rejects a non-string title", () => {
    // FormData.get() returns `File | string | null`; a File would fail here.
    expect(
      CreateIssueSchema.safeParse({ title: 42, description: "opis" }).success,
    ).toBe(false);
  });
});

describe("IssueIdSchema", () => {
  it("accepts a real UUID", () => {
    const result = IssueIdSchema.safeParse("11111111-1111-4111-8111-111111111111");
    expect(result.success).toBe(true);
  });

  it("rejects an obvious non-UUID", () => {
    expect(IssueIdSchema.safeParse("foo").success).toBe(false);
    expect(IssueIdSchema.safeParse("").success).toBe(false);
    expect(IssueIdSchema.safeParse("../../etc/passwd").success).toBe(false);
  });
});

describe("EventPayloadSchema", () => {
  it("accepts a status_change payload with the initial seed shape", () => {
    const result = EventPayloadSchema.safeParse({
      kind: "status_change",
      from: "nowe",
      to: "nowe",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a status_change with a real transition", () => {
    const result = EventPayloadSchema.safeParse({
      kind: "status_change",
      from: "nowe",
      to: "w_trakcie",
    });
    expect(result.success).toBe(true);
  });

  it("rejects status_change with an unknown status", () => {
    const result = EventPayloadSchema.safeParse({
      kind: "status_change",
      from: "nowe",
      to: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    const result = EventPayloadSchema.safeParse({
      kind: "delete",
      body: "x",
    });
    expect(result.success).toBe(false);
  });
});

describe("ChangeStatusSchema", () => {
  const validId = "11111111-1111-4111-8111-111111111111";
  const validTs = new Date().toISOString();

  it("accepts a transition to nowe", () => {
    const r = ChangeStatusSchema.safeParse({
      id: validId,
      to: "nowe",
      expectedUpdatedAt: validTs,
    });
    expect(r.success).toBe(true);
  });

  it("accepts a transition to w_trakcie", () => {
    const r = ChangeStatusSchema.safeParse({
      id: validId,
      to: "w_trakcie",
      expectedUpdatedAt: validTs,
    });
    expect(r.success).toBe(true);
  });

  it("REJECTS a transition to rozwiazane at the type level", () => {
    // The type-level fact the TDD calls out: "no path to Rozwiązane
    // skips the explanation" — resolution goes through resolveIssue
    // (Phase 5), not this schema.
    const r = ChangeStatusSchema.safeParse({
      id: validId,
      to: "rozwiazane",
      expectedUpdatedAt: validTs,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown status entirely", () => {
    const r = ChangeStatusSchema.safeParse({
      id: validId,
      to: "wtf",
      expectedUpdatedAt: validTs,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a garbage id", () => {
    const r = ChangeStatusSchema.safeParse({
      id: "not-a-uuid",
      to: "w_trakcie",
      expectedUpdatedAt: validTs,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a missing expectedUpdatedAt", () => {
    const r = ChangeStatusSchema.safeParse({
      id: validId,
      to: "w_trakcie",
      expectedUpdatedAt: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("AddCommentSchema", () => {
  const validId = "11111111-1111-4111-8111-111111111111";

  it("accepts a plain comment body", () => {
    const r = AddCommentSchema.safeParse({
      issueId: validId,
      body: "To jest komentarz.",
    });
    expect(r.success).toBe(true);
  });

  it("trims and rejects an all-whitespace body", () => {
    const r = AddCommentSchema.safeParse({
      issueId: validId,
      body: "     ",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an oversize body (>5000 chars)", () => {
    const r = AddCommentSchema.safeParse({
      issueId: validId,
      body: "x".repeat(5001),
    });
    expect(r.success).toBe(false);
  });

  it("rejects a garbage issue id", () => {
    const r = AddCommentSchema.safeParse({
      issueId: "foo",
      body: "coś",
    });
    expect(r.success).toBe(false);
  });
});
