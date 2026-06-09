import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/preguntas-ml", destination: "/conectar-ml", permanent: true },
    ];
  },
};

export default nextConfig;
