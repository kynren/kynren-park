/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kynren/shared'],
  // Clickjacking: the admin must never appear inside a frame on another site (or any site), where a press meant for that
  // page lands on a button of ours. Nothing frames the admin, so every framing is refused. frame-ancestors is the rule;
  // X-Frame-Options is the same rule for older browsers. (The API under /api sets its own X-Frame-Options through helmet.)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
