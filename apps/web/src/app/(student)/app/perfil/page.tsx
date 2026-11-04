import { getTranslations } from "next-intl/server";
import { ProfileForms } from "@/components/learn/ProfileForms";
import { AVATARS } from "@/server/services/student";
import { home } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export default async function Perfil() {
  const s = await requireStudent();
  const h = await home(s);
  const t = await getTranslations("student.profile");
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t("title")}</h1>
      <ProfileForms nickname={h.nickname} avatar={h.avatar} code={h.code} avatars={[...AVATARS]} />
    </div>
  );
}
