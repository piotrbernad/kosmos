import type { IssueAttachmentSummary } from "@/lib/issues/dto";

/**
 * Screenshots grid on the issue detail page. Every image loads through
 * `/api/attachments/[id]` — the underlying blob URL never appears in
 * the client. Clicking an image opens it full-size in a new tab (still
 * through the gated route).
 *
 * We deliberately do not use `next/image` here: the source is our
 * gated API route, not a CDN with a known origin, and the images are
 * user-uploaded so no `remotePatterns` config would cover them without
 * relaxing the guard.
 */
export function Screenshots({
  attachments,
}: {
  attachments: IssueAttachmentSummary[];
}) {
  if (attachments.length === 0) return null;

  return (
    <section
      className="stack"
      data-testid="issue-screenshots"
      aria-label="Zrzuty ekranu"
    >
      <h2>Zrzuty ekranu</h2>
      <ul
        className="row"
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {attachments.map((a) => {
          const href = `/api/attachments/${a.id}`;
          return (
            <li key={a.id} data-testid={`attachment-${a.id}`}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={a.filename}
                data-testid="attachment-link"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={href}
                  alt={a.filename}
                  loading="lazy"
                  style={{
                    width: 170,
                    height: 114,
                    objectFit: "cover",
                    borderRadius: 18,
                    background: "#e2d7c2",
                    cursor: "zoom-in",
                  }}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
