import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { logros, publicLessons } from "@/server/services/public";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixed = [
    { path: "/", priority: 1 },
    { path: "/probar", priority: 0.9 },
    { path: "/laboratorio", priority: 0.8 },
    { path: "/logros", priority: 0.8 },
    { path: "/entrar", priority: 0.5 },
    { path: "/privacidad", priority: 0.3 },
  ];
  return [
    ...fixed.map((f) => ({ url: `${SITE_URL}${f.path}`, lastModified: now, changeFrequency: "weekly" as const, priority: f.priority })),
    ...(await publicLessons()).map((l) => ({ url: `${SITE_URL}/probar/${l.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...(await logros()).filter((a) => a.has_code).map((a) => ({ url: `${SITE_URL}/logros/${a.id}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
