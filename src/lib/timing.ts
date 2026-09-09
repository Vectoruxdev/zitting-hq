/**
 * One log line per screen: route, milliseconds, and whether this instance was
 * cold — so a slow-down shows in the Vercel logs the day it lands.
 *   [page /quotes] 84ms
 *   [page /finance] 1320ms cold
 */
let served = 0;

export async function timed<T>(label: string, work: Promise<T> | (() => Promise<T>)): Promise<T> {
  const cold = served === 0;
  served++;
  const t0 = Date.now();
  try {
    return await (typeof work === "function" ? work() : work);
  } finally {
    const ms = Date.now() - t0;
    console.log(`[page ${label}] ${ms}ms${cold ? " cold" : ""}`);
  }
}
