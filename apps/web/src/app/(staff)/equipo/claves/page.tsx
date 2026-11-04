import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ApiKeys } from "@/components/staff/StaffClients";
import { PageHead } from "@/components/staff/StaffUi";
import { listApiKeys } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function Claves() {
  const p = await requireStaff();
  const t = await getTranslations("staff.keys");
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  return (
    <>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <ApiKeys keys={await listApiKeys(p)} origin={origin} />
    </>
  );
}
