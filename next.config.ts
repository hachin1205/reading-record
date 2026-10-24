import type { NextConfig } from "next";

// A fully static site (GitHub Pages): `next build` writes plain HTML/JS/CSS to out/.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
