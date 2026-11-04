import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChartLineUp, LockKey, Trophy, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { StaffSignInForm } from "@/components/site/StaffAuthForms";
import { currentStaff } from "@/server/session";
import { DEMO } from "@/server/db/seed";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("staff.auth"))("metaTitle") };
}

export default async function EquipoSignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (await currentStaff()) redirect("/equipo/panel");
  const t = await getTranslations("staff.auth");
  const local = (process.env.DATA_MODE ?? "local") === "local";
  const perks = [
    { Icon: UsersThree, title: t("perk1"), body: t("perk1Body") },
    { Icon: ChartLineUp, title: t("perk2"), body: t("perk2Body") },
    { Icon: Trophy, title: t("perk3"), body: t("perk3Body") },
  ];
  return (
    <section className="relative overflow-hidden">
      <div className="blueprint absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" aria-hidden />
      <div className="absolute -left-32 top-10 size-96 rounded-full bg-violet/15 blur-3xl" aria-hidden />
      <div className="absolute -right-32 bottom-0 size-96 rounded-full bg-pink/15 blur-3xl" aria-hidden />
      <div className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-10 md:px-6 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-700 ring-1 ring-violet/20">
            <LockKey size={14} weight="fill" aria-hidden /> {t("eyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-6xl">{t("title")}</h1>
          <p className="mt-3 max-w-[40ch] text-lg text-ink-soft">{t("subtitle")}</p>
          <ul className="mt-8 hidden space-y-3 lg:block">
            {perks.map(({ Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-violet-700 shadow-[var(--shadow-tile)]"><Icon size={22} weight="duotone" aria-hidden /></span>
                <span>
                  <span className="block font-bold">{title}</span>
                  <span className="block text-sm text-ink-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <StaffSignInForm
            googleEnabled={!local}
            authError={error === "auth"}
            demo={local ? [
              { label: t("demoFounder"), email: DEMO.founder.email, password: DEMO.founder.password },
              { label: t("demoEducator"), email: DEMO.educator.email, password: DEMO.educator.password },
            ] : undefined}
          />
        </div>
      </div>
    </section>
  );
}
