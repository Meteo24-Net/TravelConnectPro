/** @type {import('next').NextConfig} */
const nextConfig = {
  // Admin dashboard runs standalone — no need for image optimization CDN yet
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
