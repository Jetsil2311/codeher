"use client";
import { GameShell, type ShellLabels } from "./GameShell";
import { Robotina } from "./games/Robotina";
import { Interruptores } from "./games/Interruptores";
import { Nonogramas } from "./games/Nonogramas";
import { Torres } from "./games/Torres";
import { Flujo } from "./games/Flujo";
import type { GameId } from "@/server/db/types";

const GAMES = { robotina: Robotina, interruptores: Interruptores, nonogramas: Nonogramas, torres: Torres, flujo: Flujo };

export function GamePlayer({ game, title, endsAt, minutes, best, initialScore, shell, labels }: { game: GameId; title: string; endsAt: string; minutes: number; best: number; initialScore: number; shell: ShellLabels; labels: Record<string, string> }) {
  const Game = GAMES[game];
  return (
    <GameShell game={game} title={title} endsAt={endsAt} minutes={minutes} best={best} initialScore={initialScore} labels={shell}>
      {(p) => <Game {...p} labels={labels} />}
    </GameShell>
  );
}
