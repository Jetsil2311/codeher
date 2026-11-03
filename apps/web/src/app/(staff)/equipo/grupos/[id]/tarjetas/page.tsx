import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AccessCards } from "@/components/staff/AccessCards";
import { PageHead } from "@/components/staff/StaffUi";
import { groupDetail } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function Tarjetas({ params }: { params: Promise<{ id: string }> }) {
  const p = await requireStaff();
  const g = groupDetail(p, (await params).id);
  if (!g) notFound();
  const t = await getTranslations("staff.cards");
  return (
    <>
      <PageHead back={{ href: `/equipo/grupos/${g.id}`, label: g.prefix }} title={t("reprintTitle")} subtitle={t("reprintSubtitle")} />
      <AccessCards cards={g.roster.filter((s) => s.status === "active").map((s) => ({ nickname: s.nickname, code: s.code, pin: null }))} community={g.community} prefix={g.prefix} />
    </>
  );
}
