import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfkit', 'mammoth', 'pdf-parse'],
};

export default nextConfig;
