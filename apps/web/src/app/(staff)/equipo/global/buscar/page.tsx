import { getTranslations } from "next-intl/server";
import { FounderSearch } from "@/components/staff/StaffClients";
import { PageHead } from "@/components/staff/StaffUi";
import { requireFounder } from "@/server/session";

export default async function Buscar() {
  await requireFounder();
  const t = await getTranslations("staff.search");
  return (<><PageHead title={t("title")} subtitle={t("subtitle")} /><FounderSearch /></>);
}
