import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mysql2", "bcryptjs"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
