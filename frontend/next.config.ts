import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pg", "bcryptjs"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
