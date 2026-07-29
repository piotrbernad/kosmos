"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Client-side Better Auth SDK. Talks to /api/auth/*.
 *
 * `baseURL` is inferred from the current origin at runtime, so this works in
 * dev, preview, and prod without configuration.
 */
export const authClient = createAuthClient();
