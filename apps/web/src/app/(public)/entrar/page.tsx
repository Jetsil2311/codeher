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
          <div className="relative mx-auto mt-10 hidden h-56 w-full max-w-sm lg:mx-0 lg:block" aria-hidden>
            <div className="absolute left-6 top-6 h-48 w-80 rotate-[-8deg] rounded-[1.5rem] bg-gradient-to-br from-violet to-pink shadow-[var(--shadow-lift)] motion-safe:animate-float" style={{ ["--r" as string]: "-8deg" }} />
            <div className="absolute left-0 top-0 h-48 w-80 rotate-[3deg] rounded-[1.5rem] bg-midnight p-5 text-paper shadow-[0_40px_70px_-30px_rgb(26_16_54/0.8)] motion-safe:animate-float" style={{ ["--r" as string]: "3deg", animationDelay: "1.2s" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold"><span className="text-violet-300">CODE</span><span className="text-pink">HER</span></span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[0.65rem] text-[#b8acd6]">{t("cardLabel")}</span>
              </div>
              <p className="mt-6 font-mono text-[0.65rem] uppercase tracking-widest text-[#b8acd6]">{t("code")}</p>
              <p className="font-mono text-3xl font-bold tracking-[0.2em]">261101</p>
              <div className="mt-3 flex gap-2">
                {[0, 1, 2, 3].map((i) => <span key={i} className="grid size-8 place-items-center rounded-lg bg-white/10 font-mono text-lg">•</span>)}
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-md">
          {salida ? <p role="status" className="mb-4 rounded-2xl bg-[#d9fbf5] px-4 py-3 text-center font-semibold text-mint-700">{t("signedOut")}</p> : null}
          <StudentSignIn demo={local ? DEMO.students.map((st, i) => ({ nickname: st.nickname, pin: st.pin, code: `2611${String(i + 1).padStart(2, "0")}` })) : undefined} />
        </div>
      </div>
    </section>
  );
}
