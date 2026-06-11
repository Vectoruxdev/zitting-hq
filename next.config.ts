import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/**
 * Build stamp — computed once at build time and inlined into the bundle.
 * Vercel rebuilds on every push, so this updates automatically each deploy.
 *  - BUILD_NUMBER: total commit count (a sequential, ever-increasing number)
 *  - BUILD_SHA:    short commit hash of the build
 *  - BUILD_TIME:   ISO timestamp of the build
 */
function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const buildSha =
  (process.env.VERCEL_GIT_COMMIT_SHA || git("rev-parse HEAD")).slice(0, 7) || "dev";
const buildNumber = git("rev-list --count HEAD") || "0";
const buildTime = new Date().toISOString();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_NUMBER: buildNumber,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
  experimental: {
    serverActions: {
      // Receipt photos upload through a server action; the 1MB default
      // rejects any real camera photo. The client downscales to ~1MB first —
      // this is headroom for originals that slip through, not the norm.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
