import { getTranslations } from "next-intl/server";
import { ErrorCatalogEditor } from "@/components/staff/StaffClients";
import { PageHead } from "@/components/staff/StaffUi";
import { errorCatalogAll } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function Errores() {
  await requireStaff();
  const t = await getTranslations("staff.errorsPage");
  return (
    <>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <ErrorCatalogEditor rows={JSON.parse(JSON.stringify(errorCatalogAll()))} />
    </>
  );
}
