import { describe, it, expect } from "vitest";
import {
  MAX_ATTACHMENTS_PER_ISSUE,
  MAX_BYTES_PER_ATTACHMENT,
  validateAttachments,
  extensionForContentType,
  makeAttachmentKey,
  type FileLike,
} from "./validators";

function f(name: string, type: string, size: number): FileLike {
  return { name, type, size };
}

describe("validateAttachments", () => {
  it("accepts a valid single PNG", () => {
    const r = validateAttachments([f("a.png", "image/png", 1024)]);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toHaveLength(0);
  });

  it("accepts all four allowed image types", () => {
    const r = validateAttachments([
      f("a.png", "image/png", 100),
      f("b.jpg", "image/jpeg", 100),
      f("c.webp", "image/webp", 100),
      f("d.gif", "image/gif", 100),
    ]);
    expect(r.accepted).toHaveLength(4);
    expect(r.rejected).toHaveLength(0);
  });

  it("rejects a PDF with reason bad_type", () => {
    const r = validateAttachments([f("doc.pdf", "application/pdf", 100)]);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0]?.why).toBe("bad_type");
  });

  it("rejects an 11 MB file with reason too_large", () => {
    const r = validateAttachments([
      f("big.png", "image/png", MAX_BYTES_PER_ATTACHMENT + 1),
    ]);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0]?.why).toBe("too_large");
  });

  it("accepts a file exactly at the 10 MB boundary", () => {
    const r = validateAttachments([
      f("edge.png", "image/png", MAX_BYTES_PER_ATTACHMENT),
    ]);
    expect(r.accepted).toHaveLength(1);
  });

  it("accepts the first N files up to the cap and rejects the rest as too_many", () => {
    const files = Array.from({ length: MAX_ATTACHMENTS_PER_ISSUE + 2 }, (_, i) =>
      f(`img-${i}.png`, "image/png", 100),
    );
    const r = validateAttachments(files);
    expect(r.accepted).toHaveLength(MAX_ATTACHMENTS_PER_ISSUE);
    expect(r.rejected).toHaveLength(2);
    expect(r.rejected.every((x) => x.why === "too_many")).toBe(true);
  });

  it("respects existingCount so edit flow can't exceed 5 total", () => {
    const r = validateAttachments(
      [f("a.png", "image/png", 100), f("b.png", "image/png", 100)],
      MAX_ATTACHMENTS_PER_ISSUE - 1,
    );
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0]?.why).toBe("too_many");
  });

  it("does not lose good files when one bad file is mixed in", () => {
    const r = validateAttachments([
      f("good.png", "image/png", 100),
      f("bad.pdf", "application/pdf", 100),
      f("good2.jpg", "image/jpeg", 100),
    ]);
    expect(r.accepted.map((x) => x.name)).toEqual(["good.png", "good2.jpg"]);
    expect(r.rejected.map((x) => x.name)).toEqual(["bad.pdf"]);
  });

  it("rejects an empty file with reason empty", () => {
    const r = validateAttachments([f("zero.png", "image/png", 0)]);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0]?.why).toBe("empty");
  });
});

describe("extensionForContentType", () => {
  it("maps types to extensions", () => {
    expect(extensionForContentType("image/png")).toBe("png");
    expect(extensionForContentType("image/jpeg")).toBe("jpg");
    expect(extensionForContentType("image/webp")).toBe("webp");
    expect(extensionForContentType("image/gif")).toBe("gif");
  });
});

describe("makeAttachmentKey", () => {
  it("uses the issues/<id>/<slug>.<ext> format", () => {
    const key = makeAttachmentKey(
      "11111111-2222-3333-4444-555555555555",
      "image/png",
      "abc123",
    );
    expect(key).toBe(
      "issues/11111111-2222-3333-4444-555555555555/abc123.png",
    );
  });

  it("maps jpeg to .jpg extension", () => {
    expect(makeAttachmentKey("id-a", "image/jpeg", "x")).toBe(
      "issues/id-a/x.jpg",
    );
  });

  it("passes different slugs through unchanged", () => {
    const a = makeAttachmentKey("id-a", "image/jpeg", "one");
    const b = makeAttachmentKey("id-a", "image/jpeg", "two");
    expect(a).not.toBe(b);
    expect(a.endsWith(".jpg")).toBe(true);
    expect(b.endsWith(".jpg")).toBe(true);
  });
});
