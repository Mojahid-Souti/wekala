import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n.ts");

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // pnpm monorepo: trace files from repo root so standalone bundles all deps
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default withNextIntl(config);
