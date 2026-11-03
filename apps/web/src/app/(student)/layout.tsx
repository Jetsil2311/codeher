import { getTranslations } from "next-intl/server";
import { FolderSimple, House, Path, SignOut, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/components/brand/Wordmark";
import { ErrorCatalogProvider } from "@/components/code/RunParts";
import { NavLink } from "@/components/site/NavLink";
import { Avatar, StreakPill, XpPill } from "@/components/ui";
import { signOutAction } from "@/app/actions/student";
import { errorCatalog } from "@/server/services/public";
import { home } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStudent();
  const h = home(s);
  const t = await getTranslations("student.shell");
  const links = [
    { href: "/app", label: t("home"), Icon: House, exact: true },
    { href: "/app/ruta", label: t("path"), Icon: Path },
    { href: "/app/proyectos", label: t("projects"), Icon: FolderSimple },
    { href: "/app/perfil", label: t("profile"), Icon: UserCircle },
  ];
  return (
    <ErrorCatalogProvider rows={errorCatalog()}>
      <header className="sticky top-0 z-40 border-b border-ink/5 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <Wordmark size={22} href="/app" />
          <nav aria-label={t("nav")} className="hidden items-center gap-1 md:flex">
            {links.map(({ href, label, Icon, exact }) => (
              <NavLink key={href} href={href} exact={exact} variant="pill">
                <Icon size={18} weight="bold" aria-hidden /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex"><XpPill value={h.xp} label="XP" /></span>
            <StreakPill value={h.streak} label={t("streakShort")} />
            <Avatar id={h.avatar} size={36} className="hidden sm:block" />
            <form action={signOutAction}>
              <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-semibold text-paper transition active:scale-95">
                <SignOut size={16} weight="bold" aria-hidden /> {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="contenido" className="min-h-[calc(100dvh-4rem)] pb-24 md:pb-10">{children}</main>
      <nav aria-label={t("nav")} className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/8 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md">
          {links.map(({ href, label, Icon, exact }) => (
            <NavLink key={href} href={href} exact={exact} variant="bottom">
              <Icon size={24} weight="bold" aria-hidden /> {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </ErrorCatalogProvider>
  );
}
