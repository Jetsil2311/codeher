import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/Wordmark";
import { PublicNav, type PublicLink } from "./PublicNav";

export async function PublicHeader() {
  const t = await getTranslations("common.nav");
  const links: PublicLink[] = [
    { href: "/probar", label: t("probar"), desc: t("desc.probar"), icon: "probar" },
    { href: "/laboratorio", label: t("lab"), desc: t("desc.lab"), icon: "lab" },
    { href: "/logros", label: t("logros"), desc: t("desc.logros"), icon: "logros" },
    { href: "/#como-funciona", label: t("how"), desc: t("desc.how"), icon: "how" },
    { href: "/#lleva-codeher", label: t("bring"), desc: t("desc.bring"), icon: "bring" },
  ];
  return (
    <PublicNav
      links={links}
      labels={{ main: t("main"), menu: t("menu"), close: t("close"), entrar: t("entrar"), probar: t("probarCta"), staff: t("staff"), tagline: t("tagline") }}
    />
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
