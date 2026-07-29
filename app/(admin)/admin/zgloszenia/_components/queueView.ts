/**
 * Pure constants + types for the queue view preference. Split from the
 * `setQueueView` server-action file because a "use server" module can
 * only export server-only functions — types and constants have to live
 * in a plain module.
 */

export type QueueView = "tablica" | "lista";

export const QUEUE_VIEW_COOKIE = "queue-view";
