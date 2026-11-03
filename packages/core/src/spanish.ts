// Stop-word heuristic used by validators to warn (never block) when text looks non-Spanish.

const ES = new Set(
  "de la que el en y a los se del las un por con no una su para es al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros tu tú te ti tus usa escribe regresa debe tiene puedes cada número texto lista función variable".split(" "),
);
const EN = new Set(
  "the of and to in is you that it he was for on are as with his they at be this have from or one had by but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first been call who its now find long down day did get come made may part".split(" "),
);

export function looksSpanish(text: string): { spanish: boolean; esHits: number; enHits: number } {
  const words = text
    .toLowerCase()
    .replace(/`[^`]*`/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .split(/[^a-záéíóúñü]+/i)
    .filter(Boolean);
  let es = 0;
  let en = 0;
  for (const w of words) {
    if (ES.has(w)) es++;
    if (EN.has(w)) en++;
  }
  // Short strings are not judged.
  if (es + en < 4) return { spanish: true, esHits: es, enHits: en };
  return { spanish: es >= en, esHits: es, enHits: en };
}
