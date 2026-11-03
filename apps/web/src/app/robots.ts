import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public pages are open to search engines and AI search crawlers (so CODEHER can be cited);
// the student platform and the team workspace are private.
export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/app", "/equipo/", "/api/"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      { userAgent: ["GPTBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "anthropic-ai", "Google-Extended"], allow: "/", disallow: privatePaths },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
