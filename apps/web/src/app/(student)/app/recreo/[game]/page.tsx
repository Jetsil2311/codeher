import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GamePlayer } from "@/components/recreo/GamePlayer";
import { GAMES, type GameId } from "@/server/db/types";
import { recreo } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const t = await getTranslations("student.recreo");
  return { title: (GAMES as readonly string[]).includes(game) ? t(`games.${game as GameId}.title`) : t("title") };
}

export default async function Juego({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!(GAMES as readonly string[]).includes(game)) notFound();
  const s = await requireStudent();
  const status = await recreo(s);
  // A game opens only inside a running break (started from the Recreo page).
  if (!status.active || status.active.game !== game || Date.parse(status.active.ends_at) <= Date.now()) redirect("/app/recreo");
  const t = await getTranslations("student.recreo");
  const id = game as GameId;
  const raw = t.raw as unknown as (key: string) => Record<string, string>;
  return (
    <GamePlayer
      game={id}
      title={t(`games.${id}.title`)}
      endsAt={status.active.ends_at}
      minutes={Math.max(1, Math.round((Date.parse(status.active.ends_at) - Date.parse(status.active.started_at ?? status.active.ends_at)) / 60000)) || status.minutes}
      best={status.best[id] ?? 0}
      initialScore={0}
      shell={raw("shell") as never}
      labels={raw(id)}
    />
  );
}
