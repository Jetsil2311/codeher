import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/Wordmark";
import { ButtonLink } from "@/components/ui";
import { MobileMenu } from "./MobileMenu";

export async function PublicHeader() {
  const t = await getTranslations("common.nav");
  const links = [
    { href: "/probar", label: t("probar") },
    { href: "/logros", label: t("logros") },
    { href: "/#como-funciona", label: t("how") },
    { href: "/#lleva-codeher", label: t("bring") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Wordmark size={24} />
        <nav aria-label={t("main")} className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-[0.95rem] font-semibold text-ink-soft transition hover:bg-violet-100 hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/entrar" size="sm" className="hidden sm:inline-flex">
            {t("entrar")}
          </ButtonLink>
          <MobileMenu links={[...links, { href: "/entrar", label: t("entrar") }]} label={t("menu")} closeLabel={t("close")} />
        </div>
      </div>
    </header>
  );
}

export async function PublicFooter() {
  const t = await getTranslations("common.footer");
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-midnight text-paper">
      <div className="blueprint-dark absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <span className="inline-flex rounded-xl bg-paper px-3 py-2">
            <Wordmark size={22} />
          </span>
          <p className="mt-4 max-w-[38ch] text-[#d6cdea]">{t("tagline")}</p>
        </div>
        <nav aria-label={t("explore")}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#b8acd6]">{t("explore")}</h2>
          <ul className="mt-3 space-y-2">
            <li><Link className="hover:text-pink" href="/probar">{t("probar")}</Link></li>
            <li><Link className="hover:text-pink" href="/logros">{t("logros")}</Link></li>
            <li><Link className="hover:text-pink" href="/entrar">{t("entrar")}</Link></li>
            <li><Link className="hover:text-pink" href="/#lleva-codeher">{t("bring")}</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#b8acd6]">{t("about")}</h2>
          <ul className="mt-3 space-y-2">
            <li><Link className="hover:text-pink" href="/privacidad">{t("privacy")}</Link></li>
            <li><a className="hover:text-pink" href="mailto:hola@codeher.mx">hola@codeher.mx</a></li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-[#b8acd6] md:px-6">
          <p>{t("rights", { year })}</p>
          <Link href="/equipo" className="text-[#9488b3] hover:text-paper">
            {t("staff")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
