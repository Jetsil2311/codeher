import { getTranslations } from "next-intl/server";
import { Laboratorio } from "@/components/learn/Laboratorio";
import { requireStudent } from "@/server/session";

export async function generateMetadata() {
  return { title: (await getTranslations("landing.lab"))("metaTitle") };
}

export default async function StudentLab() {
  await requireStudent();
  const t = await getTranslations("landing.lab");
  return (
    <div className="mx-auto flex max-w-6xl flex-col px-4 pt-5 md:px-6 md:pt-8">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t("title")} <span className="font-accent font-semibold italic text-pink-700">{t("titleAccent")}</span></h1>
      <div className="mt-4 h-[calc(100dvh-13rem)] min-h-[480px] md:h-[calc(100dvh-10rem)]">
        <Laboratorio signedIn />
      </div>
    </div>
  );
}
