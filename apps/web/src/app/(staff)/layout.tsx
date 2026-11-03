import { getTranslations } from "next-intl/server";
import { BookOpen, Bug, ChartBar, ClipboardText, Gear, Globe, Key, SignOut, SquaresFour, Trophy, Users, UsersThree, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/components/brand/Wordmark";
import { ErrorCatalogProvider } from "@/components/code/RunParts";
import { NavLink } from "@/components/site/NavLink";
import { staffSignOutAction } from "@/app/actions/staff";
import { errorCatalog } from "@/server/services/public";
import { requireStaff } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const p = await requireStaff();
  const t = await getTranslations("staff.shell");
  const founder = p.role === "founder";
  const main = [
    { href: "/equipo/panel", label: t("panel"), Icon: SquaresFour },
    { href: "/equipo/grupos", label: t("groups"), Icon: UsersThree },
    { href: "/equipo/lecciones", label: t("lessons"), Icon: BookOpen },
    { href: "/equipo/logros", label: t("logros"), Icon: Trophy },
    { href: "/equipo/errores", label: t("errors"), Icon: Bug },
    { href: "/equipo/claves", label: t("keys"), Icon: Key },
  ];
  const global = [
    { href: "/equipo/global", label: t("global"), Icon: Globe, exact: true },
    { href: "/equipo/global/buscar", label: t("search"), Icon: MagnifyingGlass },
    { href: "/equipo/global/educadores", label: t("educators"), Icon: Users },
    { href: "/equipo/global/curaduria", label: t("curation"), Icon: ChartBar },
    { href: "/equipo/global/auditoria", label: t("audit"), Icon: ClipboardText },
    { href: "/equipo/global/ajustes", label: t("settings"), Icon: Gear },
  ];
  return (
    <ErrorCatalogProvider rows={errorCatalog()}>
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-ink/6 bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
          <div className="px-5 pb-4 pt-5">
            <Wordmark size={22} href="/equipo/panel" />
            <p className="mt-1 text-xs font-semibold text-ink-muted">{founder ? t("roleFounder") : t("roleEducator")}</p>
          </div>
          <nav aria-label={t("nav")} className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            {main.map(({ href, label, Icon }) => (
              <NavLink key={href} href={href}>
                <Icon size={20} weight="bold" aria-hidden /> {label}
              </NavLink>
            ))}
            {founder && (
              <>
                <p className="px-3.5 pb-1 pt-5 text-xs font-bold uppercase tracking-wider text-ink-muted">{t("founderOnly")}</p>
                {global.map(({ href, label, Icon, exact }) => (
                  <NavLink key={href} href={href} exact={exact}>
                    <Icon size={20} weight="bold" aria-hidden /> {label}
                  </NavLink>
                ))}
              </>
            )}
          </nav>
          <div className="border-t border-line p-4">
            <p className="truncate text-sm font-semibold">{p.display_name}</p>
            <p className="truncate text-xs text-ink-muted">{p.email}</p>
            <form action={staffSignOutAction} className="mt-3">
              <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-paper active:scale-95">
                <SignOut size={16} weight="bold" aria-hidden /> {t("signOut")}
              </button>
            </form>
          </div>
        </aside>

        <header className="sticky top-0 z-40 border-b border-ink/6 bg-white/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Wordmark size={20} href="/equipo/panel" />
            <form action={staffSignOutAction}>
              <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3 text-sm font-semibold text-paper">
                <SignOut size={15} weight="bold" aria-hidden /> {t("signOut")}
              </button>
            </form>
          </div>
          <nav aria-label={t("nav")} className="flex gap-1 overflow-x-auto px-3 pb-2">
            {[...main, ...(founder ? global : [])].map(({ href, label }) => (
              <NavLink key={href} href={href} variant="pill">
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main id="contenido" className="min-w-0 bg-paper">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
        </main>
      </div>
    </ErrorCatalogProvider>
  );
}
