import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StaffSignInForm } from "@/components/site/StaffAuthForms";
import { currentStaff } from "@/server/session";
import { DEMO } from "@/server/db/seed";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("staff.auth"))("metaTitle") };
}

export default async function EquipoSignIn() {
  if (await currentStaff()) redirect("/equipo/panel");
  const t = await getTranslations("staff.auth");
  const local = (process.env.DATA_MODE ?? "local") === "local";
  return (
    <section className="blueprint">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-5xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:px-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{t("title")}</h1>
          <p className="mt-3 max-w-[40ch] text-lg text-ink-soft">{t("subtitle")}</p>
        </div>
        <div>
          <StaffSignInForm googleEnabled={!local} />
          {local && (
            <aside className="mt-4 rounded-2xl border border-dashed border-violet/40 bg-white/80 p-4 text-sm text-ink-soft">
              <p className="font-bold text-ink">{t("demoTitle")}</p>
              <ul className="mt-2 space-y-1 font-mono text-[0.82rem]">
                <li>{DEMO.founder.email} · {DEMO.founder.password}</li>
                <li>{DEMO.educator.email} · {DEMO.educator.password}</li>
              </ul>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
