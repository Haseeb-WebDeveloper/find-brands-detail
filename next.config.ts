import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  /**
   * Everything is dynamic unless a function opts into `use cache`. Dashboard reads are deliberately
   * uncached: a review screen showing five-minute-old research is worse than a slow one.
   */
  cacheComponents: true,
  cacheLife: {
    static: { stale: 60 * 60 * 24 * 7, revalidate: 60 * 60 * 24, expire: 60 * 60 * 24 * 30 },
    standard: { stale: 60, revalidate: 300, expire: 3600 },
    live: { stale: 10, revalidate: 30, expire: 60 },
  },
};

export default nextConfig;
