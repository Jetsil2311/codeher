import { PageIn } from "@/components/motion/Motion";

// Re-mounts on every navigation inside this group, so each page eases in.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageIn>{children}</PageIn>;
}
