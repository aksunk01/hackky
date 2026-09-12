import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The interview session store and the code runner are stateful, per-process,
  // and touch the filesystem — keep them out of any bundling transform.
  serverExternalPackages: [],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
