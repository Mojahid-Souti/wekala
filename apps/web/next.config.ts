import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n.ts");

const N8N_PROXY_TARGET = process.env.N8N_PROXY_TARGET ?? "http://wekala-n8n:5678";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async rewrites() {
    return [
      // Same-origin proxy to embedded n8n. n8n writes the /n8n/ prefix into
      // its HTML when N8N_PATH=/n8n/ is set, but its internal routes still
      // live at the root (/static, /rest, /assets…) — so the proxy strips
      // the prefix before forwarding to the container.
      { source: "/n8n", destination: `${N8N_PROXY_TARGET}/` },
      { source: "/n8n/:path*", destination: `${N8N_PROXY_TARGET}/:path*` },
    ];
  },
};

export default withNextIntl(config);
