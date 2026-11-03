import { getTranslations } from "next-intl/server";
import { LogrosQueue } from "@/components/staff/StaffClients";
import { PageHead } from "@/components/staff/StaffUi";
import { listLogros } from "@/server/services/staff";
import { requireFounder } from "@/server/session";

export default async function Curaduria() {
  const p = await requireFounder();
  const t = await getTranslations("staff.logros");
  return (<><PageHead title={t("curationTitle")} subtitle={t("curationSubtitle")} /><LogrosQueue items={JSON.parse(JSON.stringify(listLogros(p)))} founder /></>);
}
