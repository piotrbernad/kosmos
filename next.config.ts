import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // TS 7.0.2 workaround: shell out to project-local tsc for build type-check
    // (see research §4). Harmless with TS 5.x too.
    useTypeScriptCli: true,
    serverActions: {
      // Sized to sit just above the attachment validators' 4 MB total-bytes
      // cap (MAX_TOTAL_BYTES_PER_SUBMISSION) plus text + form overhead.
      // Vercel's platform Function request body cap is ~4.5 MB, so pushing
      // this any higher does not actually help — clients above the total
      // cap must use direct-to-Blob client uploads instead.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
