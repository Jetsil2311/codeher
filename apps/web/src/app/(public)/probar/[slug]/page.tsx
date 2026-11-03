import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { checkPublicAnswerAction } from "@/app/actions/public";
import { LessonView } from "@/components/learn/LessonView";
import { publicLesson } from "@/server/services/public";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const l = publicLesson((await params).slug);
  return { title: l?.title ?? "Lección" };
}

export default async function ProbarLesson({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = publicLesson((await params).slug);
  if (!lesson) notFound();
  return <LessonView lesson={lesson as never} mode="visitor" actions={{ submitAnswer: checkPublicAnswerAction }} />;
}
