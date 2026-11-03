import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CodeGlyphs } from "@/components/ui";
import { StudentSignIn } from "@/components/site/StudentSignIn";
import { currentStudent } from "@/server/session";
import { DEMO } from "@/server/db/seed";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("student.signIn"))("metaTitle") };
}

export default async function Entrar({ searchParams }: { searchParams: Promise<{ salida?: string }> }) {
  if (await currentStudent()) redirect("/app");
  const t = await getTranslations("student.signIn");
  const { salida } = await searchParams;
  const local = (process.env.DATA_MODE ?? "local") === "local";
  return (
    <section className="relative overflow-hidden">
      <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]" aria-hidden />
      <CodeGlyphs />
      <div className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-12 md:px-6 lg:grid-cols-2">
        <div className="max-lg:text-center">
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            {t("title")} <span className="font-accent font-semibold italic text-gradient">{t("titleAccent")}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[40ch] text-lg text-ink-soft lg:mx-0">{t("subtitle")}</p>
        </div>
        <div className="mx-auto w-full max-w-md">
          {salida ? <p role="status" className="mb-4 rounded-2xl bg-[#d9fbf5] px-4 py-3 text-center font-semibold text-mint-700">{t("signedOut")}</p> : null}
          <StudentSignIn />
          {local && (
            <aside className="mt-4 rounded-2xl border border-dashed border-violet/40 bg-white/70 p-4 text-sm text-ink-soft">
              <p className="font-bold text-ink">{t("demoTitle")}</p>
              <p className="mt-1">{t("demoBody")}</p>
              <ul className="mt-2 space-y-1 font-mono">
                {DEMO.students.map((s, i) => (
                  <li key={s.nickname}>
                    {s.nickname}: <span className="font-bold text-ink">2611{String(i + 1).padStart(2, "0")}</span> · PIN <span className="font-bold text-ink">{s.pin}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
