import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CourseBuilder } from "@/components/staff/CourseBuilder";
import { ExportCourseButton } from "@/components/staff/LessonLibraryClient";
import { PageHead } from "@/components/staff/StaffUi";
import { Tag } from "@/components/ui";
import { courseDetail } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function Curso({ params }: { params: Promise<{ id: string }> }) {
  const p = await requireStaff();
  const data = await courseDetail(p, (await params).id);
  if (!data) notFound();
  const t = await getTranslations("staff.courses");
  return (
    <>
      <PageHead
        back={{ href: "/equipo/cursos", label: t("back") }}
        title={data.course.title}
        subtitle={t("stats", { modules: data.modules.length, lessons: data.modules.reduce((n, m) => n + m.lessons.length, 0) })}
        actions={
          <>
            {!data.editable && <Tag tone="ink">{t("readOnly")}</Tag>}
            <ExportCourseButton courseId={data.course.id} slug={data.course.slug} />
          </>
        }
      />
      <CourseBuilder data={JSON.parse(JSON.stringify(data))} />
    </>
  );
}
