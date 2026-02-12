/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
      },
      {
        protocol: "https",
        hostname: "mosaic.scdn.co",
      },
      {
        protocol: "https",
        hostname: "wrapped-images.spotifycdn.com",
      },
    ],
  },
  // Note: Body size limit is handled by Next.js automatically
  // For API routes, use bodyParser config in the route itself if needed
};

module.exports = nextConfig;
