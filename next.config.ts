import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // TS 7.0.2 workaround: shell out to project-local tsc for build type-check
    // (see research §4). Harmless with TS 5.x too.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
