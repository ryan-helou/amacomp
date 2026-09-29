import type { NextConfig } from "next";

/**
 * One id per build, baked into BOTH the client bundle and the server at build
 * time. The running app compares the id it was built with against the id the
 * server reports; when they differ, a newer build is live and the page reloads
 * itself (see components/UpdateWatcher.tsx). Without this, a home-screen app on
 * iOS restores its page from memory and never re-fetches — every deploy needed
 * a force-quit before anyone saw it.
 */
const BUILD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A stray package-lock.json in $HOME makes Turbopack guess the wrong root.
  turbopack: { root: __dirname },
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
};

export default nextConfig;
