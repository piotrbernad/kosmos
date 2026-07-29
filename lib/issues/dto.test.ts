import { describe, it, expect } from "vitest";
import { toReporterListItem, toIssueDetailForReporter } from "./dto";

const createdAt = new Date("2025-01-15T10:00:00Z");
const updatedAt = new Date("2025-01-15T10:00:00Z");

describe("toReporterListItem", () => {
  it("maps a row + attachment count into an ISO-stamped DTO", () => {
    const dto = toReporterListItem({
      id: "id-1",
      title: "Coś jest zepsute",
      description: "Opis",
      status: "nowe",
      createdAt,
      updatedAt,
      attachmentCount: 2,
    });
    expect(dto).toEqual({
      id: "id-1",
      title: "Coś jest zepsute",
      description: "Opis",
      status: "nowe",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      attachmentCount: 2,
    });
  });

  it("carries a zero attachment count through unchanged", () => {
    const dto = toReporterListItem({
      id: "id-2",
      title: "Tytuł",
      description: "Opis",
      status: "w_trakcie",
      createdAt,
      updatedAt,
      attachmentCount: 0,
    });
    expect(dto.attachmentCount).toBe(0);
  });
});

describe("toIssueDetailForReporter", () => {
  it("does not leak reporter_id or blob URLs to the DTO", () => {
    const dto = toIssueDetailForReporter({
      id: "issue-1",
      title: "Tytuł",
      description: "Opis",
      status: "nowe",
      createdAt,
      updatedAt,
      attachments: [
        {
          id: "att-1",
          filename: "screenshot.png",
          contentType: "image/png",
          sizeBytes: 1024,
        },
      ],
      events: [
        {
          id: "evt-1",
          kind: "status_change",
          payload: { kind: "status_change", from: "nowe", to: "nowe" },
          createdAt,
          actor: { id: "u-1", name: "Ola" },
        },
      ],
    });

    // Shape check — no `reporterId`, no `blobUrl` fields.
    expect(Object.keys(dto).sort()).toEqual(
      [
        "attachments",
        "createdAt",
        "description",
        "events",
        "id",
        "status",
        "title",
        "updatedAt",
      ].sort(),
    );
    expect(Object.keys(dto.attachments[0]).sort()).toEqual(
      ["contentType", "filename", "id", "sizeBytes"].sort(),
    );
    expect(dto.events).toHaveLength(1);
    expect(dto.events[0].actor).toEqual({ id: "u-1", name: "Ola" });
    expect(dto.events[0].createdAt).toBe(createdAt.toISOString());
  });

  it("substitutes an em-dash for a missing actor without exploding", () => {
    // `actor: null` happens in the LEFT JOIN type only; the fallback keeps
    // the feed rendering resilient rather than swallowing the row silently.
    const dto = toIssueDetailForReporter({
      id: "issue-2",
      title: "T",
      description: "D",
      status: "nowe",
      createdAt,
      updatedAt,
      attachments: [],
      events: [
        {
          id: "evt-2",
          kind: "status_change",
          payload: { kind: "status_change", from: "nowe", to: "nowe" },
          createdAt,
          actor: null,
        },
      ],
    });
    expect(dto.events[0].actor.name).toBe("—");
  });
});
