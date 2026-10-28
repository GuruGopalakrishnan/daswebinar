import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /**
   * Aliases for URLs used in the approved Deploy & Grow UI prototype, pointing at the existing routes
   * (docs/deploy-grow-ui-integration.md §3). Existing URLs such as /register/:id and /join/:token are never
   * redirected. Temporary (307) so a route can still move later without browsers caching the hop.
   */
  async redirects() {
    return [
      { source: "/invite/:token", destination: "/join/:token", permanent: false },
      { source: "/webinars/create", destination: "/dashboard/webinars/new", permanent: false },
      { source: "/billing", destination: "/dashboard/billing", permanent: false },
      { source: "/billing/checkout", destination: "/upgrade", permanent: false },
      // Exact path only: /recordings/:id is the replay player and stays as it is.
      { source: "/recordings", destination: "/dashboard/recordings", permanent: false },
    ];
  },
};

export default nextConfig;
