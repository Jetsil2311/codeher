import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Laboratorio } from "@/components/learn/Laboratorio";
import { currentStudent } from "@/server/session";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.lab");
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: { canonical: "/laboratorio" } };
}

export default async function LaboratorioPage() {
  const t = await getTranslations("landing.lab");
  const signedIn = !!(await currentStudent());
  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 pb-8 pt-5 md:px-6 md:pt-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight md:text-4xl">
        {t("title")} <span className="font-accent font-semibold italic text-pink-700">{t("titleAccent")}</span>
      </h1>
      <p className="mt-2 hidden max-w-[60ch] text-ink-soft sm:block">{t("subtitle")}</p>
      <div className="mt-4 h-[calc(100dvh-10rem)] min-h-[520px] sm:mt-5">
        <Laboratorio signedIn={signedIn} />
      </div>
    </div>
  );
}
