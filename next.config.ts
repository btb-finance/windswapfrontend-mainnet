import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // CORS headers for Safe Apps iframe support
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, content-type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
