import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SectionTitle } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("student.privacy"))("title") };
}

const SECTIONS = ["who", "what", "why", "logros", "who_sees", "rights", "contact"] as const;

export default async function Privacidad() {
  const t = await getTranslations("student.privacy");
  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-10 md:pt-16">
      <SectionTitle as="h1" className="text-4xl md:text-5xl">{t("title")}</SectionTitle>
      <p className="mt-4 text-lg text-ink-soft">{t("intro")}</p>
      <div className="mt-10 space-y-6">
        {SECTIONS.map((k) => (
          <section key={k} className="tile p-6">
            <h2 className="text-xl font-bold">{t(`${k}.title`)}</h2>
            <p className="mt-2 text-ink-soft">{t(`${k}.body`)}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm text-ink-muted">{t("updated")}</p>
    </article>
  );
}
