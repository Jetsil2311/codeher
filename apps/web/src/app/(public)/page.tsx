import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, ChalkboardTeacher, Code, HandHeart, Lightbulb, MapPin, Microphone, Sparkle, Users, ChartLineUp, Star } from "@phosphor-icons/react/dist/ssr";
import { CodeSnippet } from "@/components/code/CodeSnippet";
import { BringForm, TeaserEditor } from "@/components/site/LandingClient";
import { LogroCard } from "@/components/site/LogroCard";
import { Reveal } from "@/components/site/Reveal";
import { CodeMarquee, DrawLine, Faq } from "@/components/site/LandingMotion";
import { CountUp } from "@/components/motion/Motion";
import { ButtonLink, CodeGlyphs, SectionTitle } from "@/components/ui";
import { landing } from "@/server/services/public";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const HERO_CODE = `Proceso MiFuturo
    Definir sueno Como Caracter;
    sueno <- "crear tecnología";
    Si sueno <> "" Entonces
        Escribir "Yo puedo ", sueno;
    FinSi
FinProceso`;

export default async function Landing() {
  const t = await getTranslations("landing");
  const data = await landing();
  const faq = t.raw("faq.items") as { q: string; a: string }[];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": `${SITE_URL}/#org`,
        name: "CODEHER",
        url: SITE_URL,
        logo: `${SITE_URL}/icon.svg`,
        description: t("why.p2"),
        areaServed: data.communities.map((c) => ({ "@type": "Place", name: `${c.name}, ${c.state}` })),
        knowsLanguage: "es-MX",
        email: data.contact_email,
      },
      { "@type": "WebSite", "@id": `${SITE_URL}/#web`, url: SITE_URL, name: "CODEHER", inLanguage: "es-MX", publisher: { "@id": `${SITE_URL}/#org` } },
      { "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
  const phases = [
    { key: "induction", Icon: Sparkle },
    { key: "training", Icon: Code },
    { key: "projects", Icon: Lightbulb },
    { key: "presentation", Icon: Microphone },
    { key: "evaluation", Icon: ChartLineUp },
  ] as const;

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_30%,transparent_70%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-10 md:px-6 lg:min-h-[min(46rem,calc(100dvh-4rem))] lg:grid-cols-[1.05fr_1fr] lg:pt-12">
          <div className="motion-safe:animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-violet-700 ring-1 ring-violet/25">
              <MapPin size={16} weight="fill" aria-hidden /> {t("hero.eyebrow")}
            </p>
            <h1 className="mt-6 text-balance text-5xl font-extrabold leading-[1.02] tracking-[-0.03em] text-ink sm:text-6xl lg:text-7xl">
              {t("hero.titleA")}{" "}
              <span className="inline-block pb-2 font-accent font-semibold italic leading-[1.1] tracking-normal text-gradient">{t("hero.titleAccent")}</span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-soft md:text-xl">{t("hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/entrar" size="lg">
                {t("hero.ctaEnter")} <ArrowRight size={18} weight="bold" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/probar" variant="ghost" size="lg">
                {t("hero.ctaTry")}
              </ButtonLink>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none" aria-hidden>
            <div className="absolute -right-10 -top-16 size-72 rounded-full bg-violet motion-safe:animate-float md:size-96" style={{ animationDuration: "9s" }} />
            <div className="absolute -bottom-14 -left-8 size-56 rounded-full bg-pink motion-safe:animate-float md:size-72" style={{ animationDuration: "11s", animationDelay: "1s" }} />
            <div className="absolute left-[18%] top-[10%] size-20 rounded-full border-[10px] border-sun/80" />
            <div className="relative rotate-[-2deg] rounded-[1.75rem] bg-midnight p-2 shadow-[0_40px_80px_-30px_rgb(26_16_54/0.8)] ring-1 ring-white/10 motion-safe:transition motion-safe:duration-500 hover:rotate-0">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span className="size-3 rounded-full bg-pink" />
                <span className="size-3 rounded-full bg-sun" />
                <span className="size-3 rounded-full bg-mint" />
                <span className="ml-3 font-mono text-xs text-[#b8acd6]">mi_futuro.pseudo</span>
              </div>
              <div className="code-reveal rounded-[1.3rem] bg-[#140c2e] py-4">
                <CodeSnippet code={HERO_CODE} language="pseudocode_es" highlightLine={5} />
              </div>
              <div className="m-2 mt-3 rounded-2xl bg-white/6 px-4 py-3 font-mono text-sm text-mint">
                <span className="text-[#b8acd6]">salida ›</span> <span className="type-out caret inline-block">Yo puedo crear tecnología</span>
              </div>
            </div>
            <div className="absolute -left-4 top-1/3 hidden rotate-[-6deg] rounded-2xl bg-white sm:block px-4 py-3 shadow-[var(--shadow-lift)] motion-safe:animate-float md:-left-10" style={{ ["--r" as string]: "-6deg" }}>
              <p className="flex items-center gap-2 text-sm font-bold text-sun-700">
                <Star size={18} weight="fill" className="text-[#e0b800]" /> +20 XP
              </p>
            </div>
            <div className="absolute -right-2 bottom-8 hidden rotate-[5deg] rounded-2xl bg-ink sm:block px-4 py-3 text-paper shadow-[var(--shadow-lift)] motion-safe:animate-float md:-right-8" style={{ ["--r" as string]: "5deg", animationDelay: "1.4s" }}>
              <p className="font-accent text-lg italic text-pink">{t("hero.badge")}</p>
            </div>
          </div>
        </div>
      </section>

      <CodeMarquee items={["Escribir \"¡Hola!\"", "print(\"Hola\")", "Si … Entonces", "for i in range(5)", "Mientras … Hacer", "nombre <- \"Xóchitl\"", "input()", "Para i <- 1 Hasta 10", "def saluda():", "Leer edad", "if edad >= 12:", "FinProceso"]} />

      {/* ---------- Why CODEHER ---------- */}
      <section aria-labelledby="por-que" className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <Reveal>
            <SectionTitle as="h2" accent={t("why.titleAccent")} className="text-4xl md:text-5xl">
              <span id="por-que">{t("why.title")}</span>
            </SectionTitle>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="space-y-5 text-lg leading-relaxed text-ink-soft md:text-xl">
              <p>{t("why.p1")}</p>
              <p>{t("why.p2")}</p>
              <p className="font-semibold text-ink">{t("why.p3")}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- How it works: five phases ---------- */}
      <section id="como-funciona" aria-labelledby="como-funciona-t" className="relative scroll-mt-20 overflow-hidden bg-white py-20 md:py-28">
        <div className="blueprint absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6">
          <Reveal>
            <SectionTitle accent={t("how.titleAccent")}>
              <span id="como-funciona-t">{t("how.title")}</span>
            </SectionTitle>
            <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">{t("how.subtitle")}</p>
          </Reveal>
          <ol className="relative mt-14 grid gap-6 lg:grid-cols-5 lg:gap-4">
            <DrawLine vertical className="absolute left-7 top-2 h-[calc(100%-1rem)] w-0.5 lg:hidden" />
            <DrawLine className="absolute left-0 right-0 top-7 hidden h-0.5 lg:block" />
            {phases.map(({ key, Icon }, i) => (
              <li key={key} className="relative">
                <Reveal delay={0.2 + i * 0.12} className="group flex gap-4 lg:flex-col">
                  <span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl bg-ink text-paper shadow-[var(--shadow-tile)] ring-4 ring-white transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-6deg] group-hover:bg-grad">
                    <Icon size={26} weight="bold" aria-hidden />
                    <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-pink font-mono text-[0.7rem] font-bold text-ink ring-2 ring-white">{i + 1}</span>
                  </span>
                  <div className="lg:pr-2">
                    <h3 className="text-lg font-bold text-ink">{t(`how.phases.${key}.title`)}</h3>
                    <p className="mt-1 text-[0.97rem] text-ink-soft">{t(`how.phases.${key}.body`)}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Live mini-editor teaser (Midnight is the code surface) ---------- */}
      <section aria-labelledby="pruebalo" className="relative overflow-hidden bg-midnight py-20 text-paper md:py-28">
        <div className="blueprint-dark absolute inset-0" aria-hidden />
        <CodeGlyphs tone="dark" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 md:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <h2 id="pruebalo" className="text-balance text-3xl font-extrabold tracking-tight md:text-5xl">
              {t("teaser.title")} <span className="font-accent font-semibold italic text-pink">{t("teaser.titleAccent")}</span>
            </h2>
            <p className="mt-4 max-w-[44ch] text-lg text-[#d6cdea]">{t("teaser.body")}</p>
            <ul className="mt-6 space-y-3 text-[#d6cdea]">
              {(["b1", "b2", "b3"] as const).map((k) => (
                <li key={k} className="flex gap-3">
                  <span className="mt-2.5 size-2 shrink-0 rounded-full bg-grad" aria-hidden />
                  {t(`teaser.${k}`)}
                </li>
              ))}
            </ul>
            <ButtonLink href="/probar" className="mt-8" size="lg">
              {t("teaser.cta")} <ArrowRight size={18} weight="bold" aria-hidden />
            </ButtonLink>
          </Reveal>
          <Reveal delay={0.1}>
            <TeaserEditor />
          </Reveal>
        </div>
      </section>

      {/* ---------- Featured Logros (bento) ---------- */}
      <section aria-labelledby="logros-t" className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle accent={t("logros.titleAccent")}>
            <span id="logros-t">{t("logros.title")}</span>
          </SectionTitle>
          <Link href="/logros" className="inline-flex items-center gap-1.5 font-semibold text-violet-700 hover:underline">
            {t("logros.all")} <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        </Reveal>
        {data.featured.length ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
            {data.featured.map((item, i) => (
              <Reveal key={item.id} delay={i * 0.08} className={i === 0 ? "md:col-span-2 lg:row-span-2" : ""}>
                <LogroCard item={item} size={i === 0 ? "lg" : "md"} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="mt-8 text-ink-muted">{t("logros.empty")}</p>
        )}
      </section>

      {/* ---------- Where CODEHER has been ---------- */}
      <section aria-labelledby="donde" className="relative overflow-hidden bg-violet-50 py-20 md:py-28">
        <div className="dot-grid absolute inset-0 opacity-70" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <Reveal>
              <SectionTitle accent={t("where.titleAccent")}>
                <span id="donde">{t("where.title")}</span>
              </SectionTitle>
              <p className="mt-3 max-w-[48ch] text-lg text-ink-soft">{t("where.body")}</p>
              <dl className="mt-8 grid grid-cols-3 gap-3">
                {(["communities", "groups", "students"] as const).map((k) => (
                  <div key={k} className="rounded-2xl bg-white p-4 text-center ring-1 ring-violet/15">
                    <dt className="text-xs font-semibold text-ink-muted">{t(`where.totals.${k}`)}</dt>
                    <dd className="mt-1 font-mono text-3xl font-bold tabular-nums text-ink"><CountUp value={data.totals[k]} /></dd>
                  </div>
                ))}
              </dl>
            </Reveal>
            <div className="relative grid gap-5 sm:grid-cols-2">
              {data.communities.map((c, i) => (
                <Reveal key={c.name} delay={i * 0.08} className={i % 2 === 1 ? "sm:translate-y-10" : ""}>
                  <article className="group tile relative overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                    <div className={`absolute -right-10 -top-10 size-36 rounded-full transition-transform duration-700 group-hover:scale-150 ${i % 2 ? "bg-pink/25" : "bg-violet/25"}`} aria-hidden />
                    <MapPin size={28} weight="fill" className={i % 2 ? "text-pink-700" : "text-violet-700"} aria-hidden />
                    <h3 className="mt-3 text-2xl font-extrabold">{c.name}</h3>
                    <p className="text-sm text-ink-muted">{c.state}</p>
                    <p className="mt-1 text-sm font-semibold text-ink-soft">
                      {c.since_year ? t("where.since", { year: c.since_year }) : c.years.length ? t("where.years", { years: c.years.join(", ") }) : t("where.starting")}
                    </p>
                    <dl className="mt-5 flex gap-6">
                      <div>
                        <dt className="text-xs font-semibold text-ink-muted">{t("where.groups")}</dt>
                        <dd className="font-mono text-2xl font-bold tabular-nums"><CountUp value={c.groups} /></dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-ink-muted">{t("where.students")}</dt>
                        <dd className="font-mono text-2xl font-bold tabular-nums"><CountUp value={c.students} /></dd>
                      </div>
                    </dl>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Team ---------- */}
      <section aria-labelledby="equipo-t" className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <Reveal>
          <SectionTitle accent={t("team.titleAccent")}>
            <span id="equipo-t">{t("team.title")}</span>
          </SectionTitle>
          <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">{t("team.body")}</p>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-[1.3fr_1fr_1fr]">
          {data.team.length
            ? data.team.map((m, i) => (
                <Reveal key={m.name} delay={i * 0.06}>
                  <article className="tile h-full p-6">
                    <div className="grid size-14 place-items-center rounded-2xl bg-grad text-xl font-extrabold text-white">{m.name.slice(0, 1)}</div>
                    <h3 className="mt-4 text-xl font-bold">{m.name}</h3>
                    <p className="text-sm font-semibold text-violet-700">{m.role}</p>
                    <p className="mt-2 text-ink-soft">{m.bio}</p>
                  </article>
                </Reveal>
              ))
            : (["founders", "educators", "allies"] as const).map((k, i) => {
                const Icon = k === "founders" ? HandHeart : k === "educators" ? ChalkboardTeacher : Users;
                return (
                  <Reveal key={k} delay={i * 0.06}>
                    <article className={`group h-full rounded-[var(--radius-tile)] p-6 transition duration-300 hover:-translate-y-1 ${i === 0 ? "bg-ink text-paper shadow-[var(--shadow-lift)]" : "tile hover:shadow-[var(--shadow-lift)]"}`}>
                      <span className={`grid size-14 place-items-center rounded-2xl transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 ${i === 0 ? "bg-white/10 text-pink" : "bg-violet-100 text-violet-700"}`}><Icon size={28} weight="duotone" aria-hidden /></span>
                      <h3 className="mt-4 text-xl font-bold">{t(`team.roles.${k}.title`)}</h3>
                      <p className={`mt-2 ${i === 0 ? "text-[#d6cdea]" : "text-ink-soft"}`}>{t(`team.roles.${k}.body`)}</p>
                    </article>
                  </Reveal>
                );
              })}
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section aria-labelledby="faq-t" className="mx-auto max-w-4xl px-4 pb-20 md:px-6 md:pb-28">
        <Reveal>
          <SectionTitle accent={t("faq.titleAccent")}>
            <span id="faq-t">{t("faq.title")}</span>
          </SectionTitle>
        </Reveal>
        <div className="mt-8">
          <Faq items={faq} />
        </div>
      </section>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* ---------- Bring CODEHER to your community ---------- */}
      <section id="lleva-codeher" aria-labelledby="lleva-t" className="relative scroll-mt-20 overflow-hidden bg-grad py-20 md:py-28">
        <div className="dot-grid absolute inset-0 opacity-30 mix-blend-overlay" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 md:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="text-ink">
            <h2 id="lleva-t" className="text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              {t("bring.title")}
            </h2>
            <p className="mt-4 max-w-[44ch] text-xl font-bold">{t("bring.body")}</p>
          </div>
          <BringForm />
        </div>
      </section>
    </>
  );
}
