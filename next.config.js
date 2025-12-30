/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/stock-analysis',
        destination: `${process.env.PYTHON_SERVICE_URL}/api/stock-analysis`,
      },
    ];
  },
};

module.exports = nextConfig;
