import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained server bundle (.next/standalone) so the Docker
  // runtime image ships only the files it needs instead of all node_modules.
  output: "standalone",
  // In a Turborepo monorepo, tracing must start from the repo root (two levels
  // up) so shared workspace packages are included in the standalone output.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
