import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // TS 7.0.2 workaround: shell out to project-local tsc for build type-check
    // (see research §4). Harmless with TS 5.x too.
    useTypeScriptCli: true,
    serverActions: {
      // createIssue / editIssue accept up to 5 images × 10 MB per the
      // attachment validators. Next's default Server Actions body limit
      // is 1 MB, which rejected legitimate single-picture uploads.
      bodySizeLimit: "55mb",
    },
  },
};

export default nextConfig;
