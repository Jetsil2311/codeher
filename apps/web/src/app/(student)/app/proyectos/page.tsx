import { getTranslations } from "next-intl/server";
import { FolderSimple, Plus } from "@phosphor-icons/react/dist/ssr";
import { EmptyState, Field, inputClass } from "@/components/ui";
import { ProjectList } from "@/components/learn/ProjectList";
import { newBlankProjectAction } from "@/app/actions/student";
import { listProjects } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export default async function Proyectos() {
  const s = await requireStudent();
  const items = listProjects(s);
  const t = await getTranslations("student.projects");
  const tl = await getTranslations("learn.language");
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t("title")}</h1>
      <p className="mt-2 text-ink-soft">{t("subtitle")}</p>
      <form action={newBlankProjectAction} className="tile mt-6 grid gap-4 p-5 md:grid-cols-[1fr_auto_auto] md:items-end md:p-6">
        <Field label={t("newName")} htmlFor="name">
          <input id="name" name="name" placeholder={t("newPlaceholder")} maxLength={80} className={inputClass} />
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold">{t("language")}</legend>
          <div className="mt-1.5 flex gap-2">
            {(["pseudocode_es", "python"] as const).map((l, i) => (
              <label key={l} className="flex h-12 cursor-pointer items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold ring-1 ring-ink/15 has-[:checked]:bg-violet-100 has-[:checked]:ring-violet-700">
                <input type="radio" name="language" value={l} defaultChecked={i === 0} className="accent-[#8d55d0]" /> {tl(l)}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-violet-700 px-5 font-semibold text-white hover:bg-violet-800 active:scale-95">
          <Plus size={18} weight="bold" aria-hidden /> {t("create")}
        </button>
      </form>
      <div className="mt-8">
        {items.length ? <ProjectList items={items} /> : <EmptyState title={t("empty")} body={t("emptyBody")} icon={<FolderSimple size={28} weight="bold" />} />}
      </div>
    </div>
  );
}
