import { HomePage } from "@/components/home-page";
import { getMediaForPage } from "@/lib/db/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <HomePage initialItems={await getMediaForPage()} />;
}
