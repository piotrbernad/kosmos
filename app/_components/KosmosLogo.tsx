import Link from "next/link";

/**
 * The Kosmos wordmark: three brand dots (indigo circle, coral square, mixed
 * corners green) followed by "Kosmos / zgłoszenia". Rendered in the app
 * header and above the auth cards. `href` makes it a link; omit for a static
 * mark (auth screens).
 */
export function KosmosLogo({
  href,
  size = "sm",
}: {
  href?: string;
  size?: "sm" | "lg";
}) {
  const dotStyle =
    size === "lg"
      ? { width: 26, height: 26 }
      : { width: 22, height: 22 };
  const nameSize = size === "lg" ? 16 : 17;

  const inner = (
    <span className="brand">
      <span className="brand-dots" aria-hidden="true">
        <span className="brand-dot d1" style={dotStyle} />
        <span className="brand-dot d2" style={dotStyle} />
        <span className="brand-dot d3" style={dotStyle} />
      </span>
      <span className="brand-name" style={{ fontSize: nameSize }}>
        Kosmos
      </span>
      <span className="brand-sub" style={{ fontSize: nameSize }}>
        / zgłoszenia
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label="Kosmos — zgłoszenia">
        {inner}
      </Link>
    );
  }
  return inner;
}
