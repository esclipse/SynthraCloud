/** @type {import('next').NextConfig} */
const defaultPythonServiceUrl = 'https://stock-service-vi7q.onrender.com';
const pythonServiceUrl = (
  process.env.PYTHON_SERVICE_URL || defaultPythonServiceUrl
).replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/stock-analysis',
        destination: `${pythonServiceUrl}/api/stock-analysis`,
      },
    ];
  },
};

module.exports = nextConfig;
