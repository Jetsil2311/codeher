import { getTranslations } from "next-intl/server";
import { BookOpenText, Books } from "@phosphor-icons/react/dist/ssr";
import { LinkTabs } from "@/components/motion/LinkTabs";

/** Lecciones | Cursos switch shown on top of both authoring pages. */
export async function ContentTabs({ active, lessons, courses }: { active: "lessons" | "courses"; lessons: number; courses: number }) {
  const t = await getTranslations("staff.library");
  return (
    <LinkTabs
      className="mb-6"
      label={t("tabsLabel")}
      items={[
        { href: "/equipo/lecciones", label: t("tabLessons"), active: active === "lessons", icon: <BookOpenText size={16} weight="bold" aria-hidden />, count: lessons },
        { href: "/equipo/cursos", label: t("tabCourses"), active: active === "courses", icon: <Books size={16} weight="bold" aria-hidden />, count: courses },
      ]}
    />
  );
}
