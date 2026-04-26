import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfkit', 'mammoth', 'groq-sdk', 'jsonrepair', 'pdf-parse'],
};

export default nextConfig;
