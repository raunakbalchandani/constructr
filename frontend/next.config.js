/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // For deployment
  images: {
    unoptimized: true, // For static export if needed
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/:path*', // Proxy to FastAPI backend
      },
    ]
  },
}

module.exports = nextConfig
