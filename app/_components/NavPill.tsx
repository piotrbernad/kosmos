"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A header nav pill that highlights when the current path matches. `exact`
 * matches the full path; otherwise a prefix match is used so nested routes
 * keep the parent tab active.
 */
export function NavPill({
  href,
  exact = false,
  excludePrefixes = [],
  children,
}: {
  href: string;
  exact?: boolean;
  /** Prefixes that should NOT count as a match (e.g. a sibling tab's route). */
  excludePrefixes?: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const excluded = excludePrefixes.some((p) => pathname.startsWith(p));
  const active =
    !excluded && (exact ? pathname === href : pathname.startsWith(href));
  return (
    <Link href={href} className={active ? "nav-pill active" : "nav-pill"}>
      {children}
    </Link>
  );
}
