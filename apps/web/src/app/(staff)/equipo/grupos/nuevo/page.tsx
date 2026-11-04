import { getTranslations } from "next-intl/server";
import { PageHead } from "@/components/staff/StaffUi";
import { NewGroupWizard } from "@/components/staff/NewGroupWizard";
import { activeCommunities } from "@/server/services/public";
import { requireStaff } from "@/server/session";

export default async function NuevoGrupo() {
  await requireStaff();
  const t = await getTranslations("staff.newGroup");
  const communities = await activeCommunities();
  const now = new Date();
  return (
    <>
      <PageHead title={t("title")} subtitle={t("subtitle")} back={{ href: "/equipo/grupos", label: t("back") }} />
      <NewGroupWizard communities={communities} defaultYear={now.getFullYear()} defaultMonth={now.getMonth() + 1} />
    </>
  );
}
