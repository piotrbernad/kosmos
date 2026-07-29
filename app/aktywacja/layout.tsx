/**
 * Standalone layout for the admin invitation claim page.
 *
 * `/aktywacja` sits outside `app/(auth)` because the auth-group layout
 * redirects any signed-in visitor to their home surface, and a valid claim
 * must work regardless of whether the browser is signed in or out (per PRD
 * §Success Metric — the outcome is an `admin` session, whatever session was
 * there before). The visual chrome mirrors the auth layout so the two
 * screens still look like they belong together.
 */
export default function AktywacjaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="centered-card">{children}</main>;
}
