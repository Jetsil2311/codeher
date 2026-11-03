import { notFound } from "next/navigation";
import { ProjectEditor } from "@/components/learn/ProjectEditor";
import { getProject } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export default async function Proyecto({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStudent();
  const p = getProject(s, (await params).id);
  if (!p) notFound();
  return <ProjectEditor project={p} />;
}
