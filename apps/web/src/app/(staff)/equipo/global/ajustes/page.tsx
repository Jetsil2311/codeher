import { getTranslations } from "next-intl/server";
import { SettingsForm } from "@/components/staff/StaffClients";
import { PageHead } from "@/components/staff/StaffUi";
import { settings } from "@/server/services/staff";
import { requireFounder } from "@/server/session";

export default async function Ajustes() {
  const p = await requireFounder();
  const s = settings(p);
  const t = await getTranslations("staff.settings");
  return (<><PageHead title={t("title")} subtitle={t("subtitle")} /><SettingsForm settings={s.settings} communities={s.communities} /></>);
}
