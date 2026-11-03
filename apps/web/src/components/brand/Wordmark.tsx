import Link from "next/link";

// Wordmark CODEHER in Montserrat ExtraBold: CODE in Violet, HER in Pink (brief 2.1).
// Stand-in until the supplied logo files are placed in /public/brand; never recolor or outline.
export function Wordmark({ size = 26, href = "/", label = "CODEHER, inicio" }: { size?: number; href?: string | null; label?: string }) {
  const mark = (
    <span className="inline-flex select-none font-extrabold leading-none tracking-[-0.02em]" style={{ fontSize: size, minWidth: 96 }} aria-hidden={href ? true : undefined}>
      <span className="text-violet">CODE</span>
      <span className="text-pink">HER</span>
    </span>
  );
  if (!href) return <span aria-label="CODEHER">{mark}</span>;
  return (
    <Link href={href} aria-label={label} className="inline-flex rounded-lg p-1 -m-1">
      {mark}
    </Link>
  );
}
