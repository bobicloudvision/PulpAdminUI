import type { NextConfig } from "next";

// Optional sub-path, e.g. BASE_PATH=/pulp-admin when nginx serves the UI under
// https://host/pulp-admin/. Must be set at build time; empty serves from "/".
const basePath = (process.env.BASE_PATH ?? "").trim().replace(/\/+$/, "");
if (basePath && !basePath.startsWith("/")) {
  throw new Error(`BASE_PATH must start with "/" (got "${basePath}")`);
}

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_PULP_PROJECT_NAME: process.env.PULP_PROJECT_NAME,
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
