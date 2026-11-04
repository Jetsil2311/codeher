import { PublicFooter, PublicHeader } from "@/components/site/PublicChrome";
import { ErrorCatalogProvider } from "@/components/code/RunParts";
import { errorCatalog } from "@/server/services/public";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorCatalogProvider rows={await errorCatalog()}>
      <PublicHeader />
      <main id="contenido">{children}</main>
      <PublicFooter />
    </ErrorCatalogProvider>
  );
}
