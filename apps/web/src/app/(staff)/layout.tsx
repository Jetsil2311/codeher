import { getTranslations } from "next-intl/server";
import { ErrorCatalogProvider } from "@/components/code/RunParts";
import { StaffShell, type StaffLink } from "@/components/staff/StaffShell";
import { errorCatalog } from "@/server/services/public";
import { requireStaff } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const p = await requireStaff();
  const t = await getTranslations("staff.shell");
  const founder = p.role === "founder";
  const program: StaffLink[] = [
    { href: "/equipo/panel", key: "panel", label: t("panel") },
    { href: "/equipo/grupos", key: "groups", label: t("groups") },
    { href: "/equipo/lecciones", key: "lessons", label: t("lessons") },
    { href: "/equipo/logros", key: "logros", label: t("logros") },
  ];
  const tools: StaffLink[] = [
    { href: "/equipo/errores", key: "errors", label: t("errors") },
    { href: "/equipo/claves", key: "keys", label: t("keys") },
  ];
  const global: StaffLink[] = [
    { href: "/equipo/global", key: "global", label: t("global"), exact: true },
    { href: "/equipo/global/buscar", key: "search", label: t("search") },
    { href: "/equipo/global/educadores", key: "educators", label: t("educators") },
    { href: "/equipo/global/curaduria", key: "curation", label: t("curation") },
    { href: "/equipo/global/auditoria", key: "audit", label: t("audit") },
    { href: "/equipo/global/ajustes", key: "settings", label: t("settings") },
  ];
  const sections = [
    { title: t("sectionProgram"), links: program },
    { title: t("sectionTools"), links: tools },
    ...(founder ? [{ title: t("founderOnly"), links: global }] : []),
  ];
  return (
    <ErrorCatalogProvider rows={await errorCatalog()}>
      <StaffShell
        sections={sections}
        dock={program.slice(0, 3)}
        user={{ name: p.display_name, email: p.email, role: founder ? t("roleFounder") : t("roleEducator") }}
        labels={{ nav: t("nav"), signOut: t("signOut"), more: t("more"), close: t("close") }}
      >
        {children}
      </StaffShell>
    </ErrorCatalogProvider>
  );
}
