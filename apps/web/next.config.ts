import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n.ts");

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

export default withNextIntl(config);
