import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const useStandalone = process.env.NEXT_STANDALONE_BUILD === "1" || process.env.STANDALONE_BUILD === "1";

/** @type {import("next").NextConfig} */
const nextConfig = {
  ...(useStandalone && {
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname, "../.."),
  }),
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
