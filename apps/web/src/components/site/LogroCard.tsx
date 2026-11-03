import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Code, Flag, Microphone, Rocket, Star } from "@phosphor-icons/react/dist/ssr";
import type { LogroCard as Card } from "@/server/services/public";
import { LanguageBadge, Tag, cx } from "@/components/ui";
import { CodeSnippet } from "@/components/code/CodeSnippet";

const KIND_ICON = { project: Code, first_program: Rocket, first_website: Flag, community_presentation: Microphone, milestone: Star } as const;
const KIND_BG = {
  project: "from-violet to-pink",
  first_program: "from-pink to-[#ff9bd2]",
  first_website: "from-sky to-violet",
  community_presentation: "from-[#7b3fd1] to-violet",
  milestone: "from-sun to-pink",
} as const;

export async function LogroCard({ item, size = "md" }: { item: Card; size?: "md" | "lg" }) {
  const t = await getTranslations("landing.logros");
  const tl = await getTranslations("learn.language");
  const Icon = KIND_ICON[item.kind];
  return (
    <article className={cx("tile group relative flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]", size === "lg" && "md:flex-row")}>
      <div className={cx("relative overflow-hidden bg-gradient-to-br text-white", KIND_BG[item.kind], size === "lg" ? "min-h-80 md:min-h-full md:w-[55%]" : "h-36")}>
        <div className="dot-grid absolute inset-0 opacity-40 mix-blend-overlay" aria-hidden />
        <div className="absolute -right-8 -bottom-10 size-40 rounded-full bg-white/18" aria-hidden />
        <div className="absolute left-5 top-5 grid size-12 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
          <Icon size={26} weight="bold" aria-hidden />
        </div>
        {size === "lg" && item.preview && item.language ? (
          <div className="absolute inset-x-5 bottom-5 top-20 overflow-hidden rounded-2xl bg-midnight/95 py-3 [mask-image:linear-gradient(to_right,black_82%,transparent),linear-gradient(to_bottom,black_80%,transparent)] [mask-composite:intersect] shadow-[0_20px_40px_-20px_rgb(26_16_54/0.9)] ring-1 ring-white/10 md:inset-x-6">
            <CodeSnippet code={item.preview} language={item.language} className="text-[0.72rem] md:text-[0.78rem]" />
          </div>
        ) : null}
        {item.is_sample ? (
          <span className="absolute right-4 top-4 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-paper">{t("sample")}</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="violet">{t(`kind.${item.kind}`)}</Tag>
          {item.language ? <LanguageBadge language={item.language} label={tl(item.language)} size="sm" /> : null}
        </div>
        <h3 className={cx("mt-3 font-extrabold leading-snug tracking-tight text-ink", size === "lg" ? "text-2xl md:text-3xl" : "text-lg")}>{item.title}</h3>
        <p className="mt-2 text-ink-soft">{item.blurb}</p>
        <p className="mt-auto pt-4 text-sm text-ink-muted">
          <span className="font-semibold text-ink">{item.display_name}</span>
          {item.community ? ` · ${item.community}` : ""}
          {item.year ? ` · ${item.year}` : ""}
        </p>
        {item.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("tags")}>
            {item.tags.map((tag) => (
              <li key={tag}>
                <Tag tone="line">{tag}</Tag>
              </li>
            ))}
          </ul>
        )}
        {item.has_code ? (
          <Link href={`/logros/${item.id}`} className="mt-4 inline-flex items-center gap-1 self-start font-semibold text-violet-700 after:absolute after:inset-0 hover:underline">
            {t("view")} <ArrowUpRight size={16} weight="bold" aria-hidden />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
