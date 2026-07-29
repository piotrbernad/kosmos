import { z } from "zod";

/**
 * Zod schemas for invitation-related inputs. Shared by the `/aktywacja`
 * `<ClaimForm>` (as an RHF resolver-style boundary) and the server action.
 *
 * The token is a base64url-encoded 32-byte value produced by
 * `lib/invitations/service.ts::generateRawToken`. We accept any non-empty
 * URL-safe string and rely on the sha256-match lookup to reject anything
 * that didn't come out of `generateRawToken`.
 */

export const ClaimSchema = z.object({
  token: z
    .string({ error: "Brak tokenu zaproszenia." })
    .min(1, "Brak tokenu zaproszenia.")
    .max(256, "Token zaproszenia jest zbyt długi."),
  password: z
    .string({ error: "Hasło jest wymagane." })
    .min(8, "Hasło musi mieć co najmniej 8 znaków.")
    .max(1024, "Hasło jest zbyt długie."),
});

export type ClaimInput = z.infer<typeof ClaimSchema>;
