import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LessonView } from "@/components/learn/LessonView";
import { completeLessonAction, createProjectAction, submitAnswerAction, submitCodeAction } from "@/app/actions/student";
import { lesson as getLesson } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await requireStudent();
  return { title: (await getLesson(s, (await params).slug))?.title ?? "Lección" };
}

export default async function Leccion({ params }: { params: Promise<{ slug: string }> }) {
  const s = await requireStudent();
  const data = await getLesson(s, (await params).slug);
  if (!data) notFound();
  async function saveProject(code: string, title: string) {
    "use server";
    return createProjectAction({ name: title, language: data!.language, code, sourceLessonId: data!.id });
  }
  return (
    <LessonView
      lesson={data as never}
      mode="student"
      actions={{ submitCode: submitCodeAction as never, submitAnswer: submitAnswerAction as never, completeLesson: completeLessonAction, saveProject }}
    />
  );
}
