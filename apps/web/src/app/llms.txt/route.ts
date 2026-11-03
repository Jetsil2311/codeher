import { SITE_URL } from "@/lib/site";
import { publicLessons } from "@/server/services/public";

// llms.txt (llmstxt.org): a plain overview so AI assistants can describe and cite CODEHER.
export const dynamic = "force-dynamic";

export function GET() {
  const lessons = publicLessons();
  const body = `# CODEHER

> Programa social que enseña programación (Python y pseudocódigo en español) a chicas y adolescentes de 12 a 18 años en comunidades semirrurales del Estado de México. Empezó en Tequixquiac y llegó a Apaxco.

CODEHER trabaja con aprendizaje basado en proyectos en cinco fases: inducción y motivación, capacitación técnica, creación de proyectos, presentación comunitaria, y evaluación y retroalimentación. Las estudiantes entran con un código y un PIN que les da su educadora; no hay perfiles públicos ni chat. Los proyectos solo aparecen en el muro de Logros con permiso escrito de su familia.

## Páginas
- [Inicio](${SITE_URL}/): qué es CODEHER, cómo funciona y dónde ha estado.
- [Probar una lección](${SITE_URL}/probar): lecciones públicas que se ejecutan en el navegador sin registrarse.
- [Laboratorio](${SITE_URL}/laboratorio): editor libre para Python y pseudocódigo.
- [Logros](${SITE_URL}/logros): proyectos de estudiantes publicados con consentimiento.
- [Aviso de privacidad](${SITE_URL}/privacidad)

## Lecciones públicas
${lessons.map((l) => `- [${l.title}](${SITE_URL}/probar/${l.slug}) (${l.language === "python" ? "Python" : "Pseudocódigo"}): ${l.summary}`).join("\n")}

## Contacto
- Escuelas y comunidades: ${SITE_URL}/#lleva-codeher
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
