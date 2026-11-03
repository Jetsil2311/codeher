import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { checkPublicAnswerAction } from "@/app/actions/public";
import { LessonView } from "@/components/learn/LessonView";
import { publicLesson } from "@/server/services/public";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const l = publicLesson((await params).slug);
  if (!l) return { title: "Lección" };
  return { title: l.title, description: l.summary, alternates: { canonical: `/probar/${l.slug}` }, openGraph: { title: l.title, description: l.summary, type: "article" } };
}

export default async function ProbarLesson({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = publicLesson((await params).slug);
  if (!lesson) notFound();
  const ld = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: lesson.title,
    description: lesson.summary,
    inLanguage: "es-MX",
    learningResourceType: "Lección interactiva",
    educationalLevel: "Principiante",
    timeRequired: `PT${lesson.minutes}M`,
    isAccessibleForFree: true,
    teaches: lesson.language === "python" ? "Programación en Python" : "Lógica de programación con pseudocódigo",
    audience: { "@type": "EducationalAudience", educationalRole: "student", audienceType: "Adolescentes de 12 a 18 años" },
    provider: { "@type": "EducationalOrganization", name: "CODEHER", url: SITE_URL },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <LessonView lesson={lesson as never} mode="visitor" actions={{ submitAnswer: checkPublicAnswerAction }} />
    </>
  );
}
