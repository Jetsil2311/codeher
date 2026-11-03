import { getTranslations } from "next-intl/server";
import { StaffRegisterForm } from "@/components/site/StaffAuthForms";

export default async function Registro() {
  const t = await getTranslations("staff.auth");
  return (
    <section className="blueprint">
      <div className="mx-auto max-w-md px-4 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("registerTitle")}</h1>
        <p className="mt-2 text-ink-soft">{t("registerSubtitle")}</p>
        <div className="mt-6">
          <StaffRegisterForm />
        </div>
      </div>
    </section>
  );
}
