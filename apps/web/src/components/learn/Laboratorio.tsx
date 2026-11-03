"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowCounterClockwise, ArrowRight, Books, CheckCircle, FloppyDisk, HandWaving, Repeat, DiceFive, GridNine, TerminalWindow, TextAa } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage } from "@codeher/core";
import { CodeWorkspace } from "@/components/code/CodeWorkspace";
import { Segmented } from "@/components/motion/Segmented";
import { Sheet } from "@/components/motion/Sheet";
import { Stagger, StaggerItem } from "@/components/motion/Motion";
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
const EX_META: Record<string, { Icon: typeof HandWaving; tone: string }> = {
  hola: { Icon: HandWaving, tone: "from-violet to-pink" },
  ciclo: { Icon: Repeat, tone: "from-[#00bbf9] to-violet" },
  adivina: { Icon: DiceFive, tone: "from-pink to-[#ff9f6b]" },
  tabla: { Icon: GridNine, tone: "from-[#00c9a7] to-[#00bbf9]" },
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
  const [examples, setExamples] = useState(false);

  useEffect(() => {
    const d = loadDraft(lang);
    setCode(d ?? EXAMPLES[lang].hola);
    setVersion((v) => v + 1);
    setSaved(null);
  }, [lang]);
  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(null), 6000);
    return () => clearTimeout(id);
  }, [saved]);

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

  const hb = "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-[#d6cdea] transition hover:bg-white/10 hover:text-paper active:scale-95";
  const headerExtra = (
    <>
      <button type="button" onClick={() => setExamples(true)} title={t("examples")} aria-label={t("examples")} className={cx(hb, "w-10 md:w-auto md:px-3")}>
        <Books size={19} weight="bold" aria-hidden /> <span className="hidden md:inline">{t("examples")}</span>
      </button>
      <button type="button" onClick={() => load(EXAMPLES[lang].hola)} title={t("reset")} aria-label={t("reset")} className={cx(hb, "w-10")}>
        <ArrowCounterClockwise size={18} weight="bold" aria-hidden />
      </button>
      {signedIn ? (
        <button type="button" disabled={busy} onClick={save} title={t("save")} aria-label={t("save")} className={cx(hb, "w-10 disabled:opacity-50 md:w-auto md:px-3")}>
          <FloppyDisk size={19} weight="bold" aria-hidden /> <span className="hidden md:inline">{t("saveShort")}</span>
        </button>
      ) : (
        <Link href="/entrar" title={t("signInToSave")} aria-label={t("signInToSave")} className={cx(hb, "w-10 md:w-auto md:px-3")}>
          <FloppyDisk size={19} weight="bold" aria-hidden /> <span className="hidden md:inline">{t("saveShort")}</span>
        </Link>
      )}
      <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-3">
        <Segmented
          label={t("language")}
          value={lang}
          onChange={setLang}
          className="w-full sm:w-auto"
          stretch
          options={[
            { value: "pseudocode_es", label: tl("pseudocode_es"), icon: <TextAa size={16} weight="bold" aria-hidden /> },
            { value: "python", label: tl("python"), icon: <TerminalWindow size={16} weight="bold" aria-hidden /> },
          ]}
        />
        <p className="ml-auto hidden text-sm text-ink-muted lg:block">{t("tip1")}</p>
      </div>

      <CodeWorkspace
        key={`${lang}-${version}`}
        language={lang}
        code={code}
        onCodeChange={(c) => {
          setCode(c);
          saveDraft(lang, c);
        }}
        fill
        allowFullscreen
        headerExtra={headerExtra}
        title={lang === "python" ? "laboratorio.py" : "laboratorio.pseudo"}
        className="min-h-[420px] flex-1"
      />

      <AnimatePresence>
        {saved && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="absolute inset-x-0 bottom-20 z-10 mx-auto flex w-fit items-center gap-3 rounded-full bg-white py-2 pl-3 pr-2 text-sm font-semibold text-ink shadow-[var(--shadow-lift)] ring-1 ring-mint-700/20"
          >
            <CheckCircle size={22} weight="fill" className="text-mint-700" aria-hidden /> {t("saved")}
            <Link href={`/app/proyectos/${saved}`} className="inline-flex h-9 items-center gap-1 rounded-full bg-ink px-3.5 text-paper">
              {t("open")} <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={examples} onClose={() => setExamples(false)} title={t("examples")} closeLabel={t("close")}>
        <p className="-mt-1 mb-4 text-sm text-ink-muted">{t("examplesBody", { lang: tl(lang) })}</p>
        <Stagger as="ul" className="grid gap-3 sm:grid-cols-2">
          {Object.entries(EXAMPLES[lang]).map(([k, src]) => {
            const { Icon, tone } = EX_META[k];
            return (
              <StaggerItem as="li" key={k}>
                <button
                  type="button"
                  onClick={() => {
                    load(src);
                    setExamples(false);
                  }}
                  className="group flex w-full flex-col overflow-hidden rounded-[1.25rem] bg-white text-left ring-1 ring-ink/[0.07] transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-tile)] active:scale-[0.98]"
                >
                  <span className={cx("relative h-24 overflow-hidden bg-gradient-to-br p-3", tone)} aria-hidden>
                    <Icon size={26} weight="fill" className="absolute right-3 top-3 text-white/90" />
                    <pre className="absolute -bottom-2 left-3 right-10 rounded-t-xl bg-midnight/90 px-3 pt-2 font-mono text-[0.62rem] leading-relaxed text-[#d9c2fa] transition-transform duration-500 group-hover:-translate-y-1">
                      {src.split("\n").slice(0, 4).join("\n")}
                    </pre>
                  </span>
                  <span className="flex items-center justify-between gap-2 p-3.5">
                    <span>
                      <span className="block font-bold">{t(`exampleNames.${k}` as "exampleNames.hola")}</span>
                      <span className="block text-xs text-ink-muted">{t(`exampleDesc.${k}` as "exampleDesc.hola")}</span>
                    </span>
                    <ArrowRight size={18} weight="bold" className="shrink-0 text-violet-700 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </button>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Sheet>
    </div>
  );
}
