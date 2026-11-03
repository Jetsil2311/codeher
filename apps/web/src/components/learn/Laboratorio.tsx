"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowCounterClockwise, CheckCircle, FloppyDisk } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage } from "@codeher/core";
import { CodeWorkspace } from "@/components/code/CodeWorkspace";
import { createProjectAction } from "@/app/actions/student";
import { cx } from "@/components/ui";

const EXAMPLES: Record<CodeLanguage, Record<string, string>> = {
  pseudocode_es: {
    hola: 'Proceso Hola\n    Definir nombre Como Caracter;\n    Escribir "¿Cómo te llamas?";\n    Leer nombre;\n    Escribir "¡Hola, ", nombre, "!";\nFinProceso\n',
    ciclo: "Proceso Cuenta\n    Definir i Como Entero;\n    Para i <- 1 Hasta 5 Hacer\n        Escribir \"Vuelta \", i;\n    FinPara\nFinProceso\n",
    adivina: 'Proceso Adivina\n    Definir secreto, intento Como Entero;\n    secreto <- ALEATORIO(1, 10);\n    Repetir\n        Escribir "Adivina un número del 1 al 10:";\n        Leer intento;\n        Si intento < secreto Entonces\n            Escribir "Más alto";\n        Sino\n            Si intento > secreto Entonces\n                Escribir "Más bajo";\n            FinSi\n        FinSi\n    Hasta Que intento = secreto\n    Escribir "¡Lo lograste!";\nFinProceso\n',
    tabla: "Proceso Tabla\n    Definir n, i Como Entero;\n    n <- 7;\n    Para i <- 1 Hasta 10 Hacer\n        Escribir n, \" x \", i, \" = \", n * i;\n    FinPara\nFinProceso\n",
  },
  python: {
    hola: 'nombre = input("¿Cómo te llamas? ")\nprint("¡Hola, " + nombre + "!")\n',
    ciclo: 'for i in range(1, 6):\n    print("Vuelta", i)\n',
    adivina: 'import random\n\nsecreto = random.randint(1, 10)\nintento = int(input("Adivina un número del 1 al 10: "))\nif intento == secreto:\n    print("¡Lo lograste!")\nelse:\n    print("Era el", secreto)\n',
    tabla: 'n = 7\nfor i in range(1, 11):\n    print(n, "x", i, "=", n * i)\n',
  },
};

const KEY = (l: CodeLanguage) => `codeher.lab.${l}`;
function loadDraft(l: CodeLanguage) {
  try {
    return localStorage.getItem(KEY(l));
  } catch {
    return null;
  }
}
function saveDraft(l: CodeLanguage, code: string) {
  try {
    localStorage.setItem(KEY(l), code);
  } catch {
    /* private mode: drafts are a convenience only */
  }
}

export function Laboratorio({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("landing.lab");
  const tl = useTranslations("learn.language");
  const [lang, setLang] = useState<CodeLanguage>("pseudocode_es");
  const [code, setCode] = useState(EXAMPLES.pseudocode_es.hola);
  const [version, setVersion] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = loadDraft(lang);
    setCode(d ?? EXAMPLES[lang].hola);
    setVersion((v) => v + 1);
    setSaved(null);
  }, [lang]);

  const save = async () => {
    setBusy(true);
    const r = await createProjectAction({ name: `Laboratorio ${new Date().toLocaleDateString("es-MX")}`, language: lang, code, sourceLessonId: null });
    setBusy(false);
    if (r.ok) setSaved(r.data);
  };

  const load = (c: string) => {
    setCode(c);
    saveDraft(lang, c);
    setVersion((v) => v + 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <div role="tablist" aria-label={t("language")} className="inline-flex shrink-0 rounded-full bg-white p-1 ring-1 ring-ink/[0.08]">
          {(["pseudocode_es", "python"] as const).map((l) => (
            <button key={l} role="tab" aria-selected={lang === l} type="button" onClick={() => setLang(l)} className={cx("h-9 rounded-full px-3 text-sm font-semibold transition sm:px-4", lang === l ? "bg-violet-700 text-white" : "text-ink-soft hover:bg-violet-50")}>
              {tl(l)}
            </button>
          ))}
        </div>
        <label htmlFor="lab-example" className="sr-only">{t("examples")}</label>
        <select id="lab-example" value="" onChange={(e) => e.target.value && load(EXAMPLES[lang][e.target.value])} className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-sm font-semibold text-ink ring-1 ring-ink/[0.08] focus:outline-none focus:ring-2 focus:ring-violet-700 sm:max-w-48 sm:flex-none">
          <option value="">{t("examples")}</option>
          {Object.keys(EXAMPLES[lang]).map((k) => (
            <option key={k} value={k}>{t(`exampleNames.${k}` as "exampleNames.hola")}</option>
          ))}
        </select>
        <button type="button" onClick={() => load(EXAMPLES[lang].hola)} aria-label={t("reset")} title={t("reset")} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink-soft ring-1 ring-ink/[0.08] hover:text-ink sm:hidden">
          <ArrowCounterClockwise size={18} weight="bold" aria-hidden />
        </button>
        <button type="button" onClick={() => load(EXAMPLES[lang].hola)} className="hidden h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-white sm:inline-flex">
          <ArrowCounterClockwise size={16} weight="bold" aria-hidden /> {t("reset")}
        </button>
        <div className="ml-auto hidden sm:block">
          {signedIn ? (
            saved ? (
              <Link href={`/app/proyectos/${saved}`} className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[#d9fbf5] px-4 text-sm font-semibold text-mint-700">
                <CheckCircle size={18} weight="fill" aria-hidden /> {t("saved")} {t("open")}
              </Link>
            ) : (
              <button type="button" disabled={busy} onClick={save} className="inline-flex h-12 items-center gap-1.5 rounded-full bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
                <FloppyDisk size={18} weight="bold" aria-hidden /> {t("save")}
              </button>
            )
          ) : (
            <Link href="/entrar" className="text-sm font-semibold text-violet-700 underline underline-offset-4">{t("signInToSave")}</Link>
          )}
        </div>
      </div>
      {!signedIn && <Link href="/entrar" className="text-sm font-semibold text-violet-700 underline underline-offset-4 sm:hidden">{t("signInToSave")}</Link>}
      {signedIn && (
        <div className="sm:hidden">
          {saved ? (
            <Link href={`/app/proyectos/${saved}`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#d9fbf5] px-4 text-sm font-semibold text-mint-700"><CheckCircle size={18} weight="fill" aria-hidden /> {t("saved")} {t("open")}</Link>
          ) : (
            <button type="button" disabled={busy} onClick={save} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-50"><FloppyDisk size={18} weight="bold" aria-hidden /> {t("save")}</button>
          )}
        </div>
      )}
      <CodeWorkspace key={`${lang}-${version}`} language={lang} code={code} onCodeChange={(c) => { setCode(c); saveDraft(lang, c); }} fill allowFullscreen title={lang === "python" ? "laboratorio.py" : "laboratorio.pseudo"} className="min-h-[420px] flex-1" />
    </div>
  );
}
