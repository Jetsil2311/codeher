import { getTranslations } from "next-intl/server";
import { FolderSimple } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/ui";
import { NewProject } from "@/components/learn/NewProject";
import { ProjectList } from "@/components/learn/ProjectList";
import { listProjects } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export default async function Proyectos() {
  const s = await requireStudent();
  const items = await listProjects(s);
  const t = await getTranslations("student.projects");
  const tl = await getTranslations("learn.language");
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:px-8 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t("title")}</h1>
          <p className="mt-2 max-w-[52ch] text-ink-soft">{t("subtitle")}</p>
        </div>
        <NewProject
          labels={{
            open: t("newOpen"),
            title: t("newTitle"),
            name: t("newName"),
            placeholder: t("newPlaceholder"),
            language: t("language"),
            create: t("create"),
            close: t("close"),
            pseudo: tl("pseudocode_es"),
            python: tl("python"),
            pseudoBody: t("pseudoBody"),
            pythonBody: t("pythonBody"),
          }}
        />
      </div>
      <div className="mt-8">
        {items.length ? <ProjectList items={items} /> : <EmptyState title={t("empty")} body={t("emptyBody")} icon={<FolderSimple size={28} weight="bold" />} />}
      </div>
    </div>
  );
}
