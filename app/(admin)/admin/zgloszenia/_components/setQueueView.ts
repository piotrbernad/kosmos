"use server";

import { cookies } from "next/headers";
import { QUEUE_VIEW_COOKIE, type QueueView } from "./queueView";

/**
 * Persists the admin's chosen view so a reload keeps whatever they last
 * picked. Cookie is set from a Server Action rather than the client so
 * it lands on the same response the RSC render observes.
 */
export async function setQueueView(view: QueueView): Promise<void> {
  const store = await cookies();
  store.set(QUEUE_VIEW_COOKIE, view, {
    path: "/",
    // A year — the choice is a preference, not a session.
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
}
