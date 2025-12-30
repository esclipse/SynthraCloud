/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const pythonService =
      process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/stock-strategy',
        destination: `${pythonService}/analyze`,
      },
    ];
  },
};

module.exports = nextConfig;
