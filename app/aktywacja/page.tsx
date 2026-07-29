import { notFound } from "next/navigation";
import { lookupUnusedInvitation } from "@/lib/invitations/service";
import { ClaimForm } from "./ClaimForm";

/**
 * Admin invitation claim page.
 *
 * A visitor arrives here with `?token=<raw>` printed by `admin:invite`. We
 * look the token up server-side and 404 on any miss (bad token, expired,
 * already used, missing param). Only on a valid, unused invitation do we
 * render the set-password form — and we deliberately do NOT reveal the
 * invited email in the page copy, because a leaked activation URL should
 * not double as an account-name disclosure. The form calls `claimInvitation`
 * which writes the password, signs the invitee in, and redirects.
 */
export default async function AktywacjaPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;
  if (!token) notFound();

  const invitation = await lookupUnusedInvitation(token);
  if (!invitation) notFound();

  return (
    <div className="card stack-lg">
      <div>
        <h1>Aktywacja konta administratora</h1>
        <p className="muted">
          Ustaw hasło, żeby dokończyć aktywację. Konto administratora zostanie
          zalogowane automatycznie.
        </p>
      </div>
      <ClaimForm token={token} />
    </div>
  );
}
