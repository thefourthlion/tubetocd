const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Keep tracing rooted on this package even if a parent lockfile exists
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
