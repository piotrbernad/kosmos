import { z } from "zod";
import { ISSUE_STATUSES, type IssueStatus } from "@/lib/db/schema";

/**
 * Zod schemas for issue-related inputs. Shared by both the client form
 * (RHF resolver) and the Server Actions (`safeParse` at the boundary).
 *
 * Phase 2 ships only the text-first `CreateIssueSchema` plus id +
 * event-payload primitives; attachment, edit, comment, and status
 * schemas arrive in later phases.
 */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ error: () => `${label} jest wymagane.` })
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(min, `${label}: minimum ${min} znaków.`)
        .max(max, `${label}: maksymalnie ${max} znaków.`),
    );

export const CreateIssueSchema = z.object({
  title: trimmed(3, 200, "Tytuł"),
  description: trimmed(1, 5000, "Opis"),
});

export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;

/**
 * UUID v4-ish shape. Drizzle's `uuid().defaultRandom()` writes RFC 4122
 * random UUIDs, so a plain UUID check is enough.
 */
export const IssueIdSchema = z.uuid({ error: "Nieprawidłowy identyfikator zgłoszenia." });

export type IssueId = z.infer<typeof IssueIdSchema>;

/**
 * Event payloads persisted in `issue_events.payload` as JSONB. The wider
 * `resolution`/`edit` shapes are added when Phase 4/5 lands; for Phase 2 the
 * only kind ever written is `status_change` (the seed row when an issue is
 * created), so the union below is small on purpose.
 */
const IssueStatusEnum = z.enum(ISSUE_STATUSES);
export type { IssueStatus };

export const EventPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("comment"),
    body: z.string().min(1).max(5000),
  }),
  z.object({
    kind: z.literal("status_change"),
    from: IssueStatusEnum,
    to: IssueStatusEnum,
  }),
  z.object({
    kind: z.literal("edit"),
    fields: z.array(z.enum(["title", "description", "attachments"])).min(1),
  }),
  z.object({
    kind: z.literal("resolution"),
    body: z.string().min(10).max(2000),
  }),
]);

export type EventPayload = z.infer<typeof EventPayloadSchema>;
export type EventKind = EventPayload["kind"];
