/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Disable image optimisation for local-only mode so dev doesn't need a remote loader.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
