import { getTranslations } from "next-intl/server";
import { LogrosQueue } from "@/components/staff/StaffClients";
import { PageHead } from "@/components/staff/StaffUi";
import { listLogros } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function LogrosStaff() {
  const p = await requireStaff();
  const t = await getTranslations("staff.logros");
  return (
    <>
      <PageHead title={t("title")} subtitle={p.role === "founder" ? t("subtitleFounder") : t("subtitle")} />
      <LogrosQueue items={JSON.parse(JSON.stringify(await listLogros(p)))} founder={p.role === "founder"} />
    </>
  );
}
