import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_PULP_PROJECT_NAME: process.env.PULP_PROJECT_NAME,
  },
};

export default nextConfig;
