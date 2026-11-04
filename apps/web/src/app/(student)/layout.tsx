import { getTranslations } from "next-intl/server";
import { levelProgress, xpToNextLevel } from "@codeher/core";
import { ErrorCatalogProvider } from "@/components/code/RunParts";
import { StudentShell } from "@/components/learn/StudentShell";
import { errorCatalog } from "@/server/services/public";
import { home, recreo } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStudent();
  const [h, rc] = await Promise.all([home(s), recreo(s)]);
  const t = await getTranslations("student.shell");
  const th = await getTranslations("student.home");
  const links = [
    { href: "/app", key: "home" as const, label: t("home"), short: t("home"), exact: true },
    { href: "/app/ruta", key: "path" as const, label: t("path"), short: t("pathShort") },
    { href: "/app/laboratorio", key: "lab" as const, label: t("lab"), short: t("labShort") },
    { href: "/app/proyectos", key: "projects" as const, label: t("projects"), short: t("projects") },
    { href: "/app/perfil", key: "profile" as const, label: t("profile"), short: t("profileShort") },
    { href: "/app/recreo", key: "recreo" as const, label: t("recreo"), short: t("recreo"), dock: false },
  ];
  const toNext = xpToNextLevel(h.xp);
  return (
    <ErrorCatalogProvider rows={await errorCatalog()}>
      <StudentShell
        links={links}
        me={{ nickname: h.nickname, avatar: h.avatar, xp: h.xp, level: h.level, progress: levelProgress(h.xp), toNext, streak: h.streak, community: h.group.community, tickets: rc.tickets, recreoOn: rc.enabled || !!rc.free_until }}
        labels={{
          nav: t("nav"),
          signOut: t("signOut"),
          level: th("level"),
          streak: th("streak"),
          xpToNext: t("xpToNext", { n: toNext }),
          account: t("account"),
          days: t("streakShort"),
          close: t("close"),
          tickets: t("tickets"),
        }}
      >
        {children}
      </StudentShell>
    </ErrorCatalogProvider>
  );
}
