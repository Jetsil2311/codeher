import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Info } from "@phosphor-icons/react/dist/ssr";
import { Playground } from "@/components/code/Playground";
import { Tag } from "@/components/ui";
import { logro } from "@/server/services/public";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: (await logro((await params).id))?.title ?? "Logro" };
}

export default async function LogroDetail({ params }: { params: Promise<{ id: string }> }) {
  const item = await logro((await params).id);
  if (!item) notFound();
  const t = await getTranslations("landing.logrosPage");
  const tk = await getTranslations("landing.logros");
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 md:px-6 md:pt-12">
      <Link href="/logros" className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline">
        <ArrowLeft size={16} weight="bold" aria-hidden /> {t("back")}
      </Link>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Tag tone="violet">{tk(`kind.${item.kind}`)}</Tag>
        {item.is_sample ? <Tag tone="ink">{tk("sample")}</Tag> : null}
      </div>
      <h1 className="mt-3 text-balance text-4xl font-extrabold tracking-tight md:text-5xl">{item.title}</h1>
      <p className="mt-3 text-lg text-ink-soft">{item.blurb}</p>
      <p className="mt-3 text-sm text-ink-muted">
        <span className="font-semibold text-ink">{item.display_name}</span>
        {item.community ? ` · ${item.community}` : ""}
        {item.year ? ` · ${item.year}` : ""}
      </p>
      {item.code && item.language ? (
        <section className="mt-8 tile p-4 md:p-6">
          <p className="mb-4 flex items-center gap-2 rounded-2xl bg-violet-100 px-4 py-3 text-sm text-ink">
            <Info size={18} weight="fill" className="text-violet-700" aria-hidden /> {t("readOnly")}
          </p>
          <Playground language={item.language} code={item.code} readOnly minHeight={260} />
        </section>
      ) : (
        <p className="mt-8 text-ink-muted">{t("noCode")}</p>
      )}
    </div>
  );
}
