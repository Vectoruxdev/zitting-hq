/**
 * A promise that rejects with nobody listening ends the whole Node process on
 * Vercel ("Node.js process exited with exit status: 128") and every request in
 * flight on that instance with it. On 2026-09-11 20:01 UTC that was postgres.js
 * tearing down a drained pool after a stall (a CONNECTION_DESTROYED from its
 * own cleanup timer); the crash cold-started the next four minutes of requests
 * and turned a blip into an outage. Log it, keep serving.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[unhandled rejection]", reason instanceof Error ? reason.stack ?? reason.message : reason);
});

export {};
