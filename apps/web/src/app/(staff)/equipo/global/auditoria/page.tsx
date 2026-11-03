import { getTranslations } from "next-intl/server";
import { PageHead, Panel, TableWrap, td, th } from "@/components/staff/StaffUi";
import { Tag } from "@/components/ui";
import { audit } from "@/server/services/staff";
import { requireFounder } from "@/server/session";

export default async function Auditoria() {
  const p = await requireFounder();
  const rows = audit(p);
  const t = await getTranslations("staff.audit");
  const fmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Mexico_City" });
  return (
    <>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <Panel>
        <TableWrap label={t("title")}>
          <thead><tr className="border-b border-line"><th scope="col" className={th}>{t("when")}</th><th scope="col" className={th}>{t("who")}</th><th scope="col" className={th}>{t("action")}</th><th scope="col" className={th}>{t("detail")}</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={`${r.source}-${r.id}`} className="border-b border-line/70 last:border-0 align-top">
              <td className={`${td} whitespace-nowrap font-mono text-xs`}>{fmt.format(new Date(r.created_at))}</td>
              <td className={td}>{r.actor ?? <Tag tone="line">{t(`kind.${r.actor_kind}` as "kind.system")}</Tag>}</td>
              <td className={td}><span className="font-mono text-xs font-bold">{r.action}</span><span className="block text-xs text-ink-muted">{r.entity_type}</span></td>
              <td className={`${td} max-w-xs break-words font-mono text-xs text-ink-muted`}>{Object.keys(r.payload).length ? JSON.stringify(r.payload) : "·"}</td>
            </tr>
          ))}</tbody>
        </TableWrap>
      </Panel>
    </>
  );
}
