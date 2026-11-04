import { getTranslations } from "next-intl/server";
import { RecreoHub } from "@/components/recreo/RecreoHub";
import { GAMES } from "@/server/db/types";
import { recreo } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export async function generateMetadata() {
  return { title: (await getTranslations("student.recreo"))("title") };
}

export default async function Recreo() {
  const s = await requireStudent();
  const status = await recreo(s);
  const t = await getTranslations("student.recreo");
  const te = await getTranslations("errors");
  const toward = status.lessons_per_ticket - status.toward_next;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8 md:pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
        {t("title")} <span className="font-accent font-semibold italic text-pink-700">{t("titleAccent")}</span>
      </h1>
      <p className="mt-2 max-w-[62ch] text-ink-soft">{t("subtitle")}</p>
      <div className="mt-6">
        <RecreoHub
          status={status}
          games={GAMES.map((id) => ({ id, title: t(`games.${id}.title`), tagline: t(`games.${id}.tagline`), skill: t(`games.${id}.skill`) }))}
          labels={{
            tickets: t("tickets"), ticketsOf: t("ticketsOf", { n: status.tickets, max: status.max_tickets }), progress: t("progress", { n: toward }),
            full: t("full"), disabled: t("disabled"), active: t("active"), activeBody: t.raw("activeBody") as string, play: t("play"), useTicket: t("useTicket"),
            locked: t("locked"), best: t.raw("best") as string, noBest: t("noBest"), goLearn: t("goLearn"), starting: t("starting"), skills: t("skills"),
            freeTitle: t("freeTitle"), freeBody: t.raw("freeBody") as string, confirmTitle: t("confirmTitle"), confirmBody: t("confirmBody"), confirm: t("confirm"), cancel: t("cancel"), close: t("close"), maxNote: t("maxNote"),
            err_no_tickets: te("no_tickets"), err_recreo_disabled: te("recreo_disabled"), err_invalid_game: te("invalid_game"), err_unexpected: te("unexpected"),
          }}
        />
      </div>
    </div>
  );
}
