import { getTranslations } from "next-intl/server";
import { EducatorsManager } from "@/components/staff/StaffClients";
import { PageHead } from "@/components/staff/StaffUi";
import { staffDirectory } from "@/server/services/staff";
import { requireFounder } from "@/server/session";

export default async function Educadores() {
  const p = await requireFounder();
  const t = await getTranslations("staff.educators");
  return (<><PageHead title={t("title")} subtitle={t("subtitle")} /><EducatorsManager dir={await staffDirectory(p)} selfId={p.id} /></>);
}
