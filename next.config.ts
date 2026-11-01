import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};
export default config;
