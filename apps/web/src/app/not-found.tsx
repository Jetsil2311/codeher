import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, BookOpenText, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/components/brand/Wordmark";

export default async function NotFound() {
  const t = await getTranslations("common.notFound");
  return (
    <main id="contenido" className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-16">
      <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" aria-hidden />
      <div className="absolute -left-24 top-10 size-80 rounded-full bg-violet/20 blur-3xl" aria-hidden />
      <div className="absolute -right-24 bottom-10 size-80 rounded-full bg-pink/20 blur-3xl" aria-hidden />
      <div className="relative w-full max-w-xl text-center">
        <Wordmark size={24} />
        <p className="mt-8 font-mono text-[7rem] font-bold leading-none tracking-tighter text-gradient md:text-[9rem]">404</p>
        <div className="mx-auto mt-6 max-w-md overflow-hidden rounded-[1.5rem] bg-midnight text-left text-paper shadow-[var(--shadow-lift)]">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-pink" /><span className="size-2.5 rounded-full bg-sun" /><span className="size-2.5 rounded-full bg-mint" />
            <span className="ml-2 font-mono text-xs text-[#b8acd6]">buscar_pagina.pseudo</span>
          </div>
          <pre className="px-4 py-3 font-mono text-sm leading-relaxed"><span className="text-[#c9a6f5]">Si</span> pagina = <span className="text-sun">Nulo</span> <span className="text-[#c9a6f5]">Entonces</span>{"\n"}    <span className="text-[#c9a6f5]">Escribir</span> <span className="text-mint">&quot;{t("code")}&quot;</span>;{"\n"}<span className="text-[#c9a6f5]">FinSi</span></pre>
          <div className="m-2 flex items-start gap-3 rounded-2xl bg-pink-100 p-3 text-ink">
            <WarningCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-pink-700" aria-hidden />
            <div>
              <h1 className="font-bold">{t("title")}</h1>
              <p className="text-sm text-ink-soft">{t("body")}</p>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="grad-edge inline-flex h-12 items-center gap-2 rounded-full bg-pink px-6 font-bold text-ink shadow-[var(--shadow-pop)]">
            <ArrowLeft size={18} weight="bold" aria-hidden /> {t("home")}
          </Link>
          <Link href="/probar" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink ring-1 ring-ink/10">
            <BookOpenText size={18} weight="bold" aria-hidden /> {t("lessons")}
          </Link>
        </div>
      </div>
    </main>
  );
}
