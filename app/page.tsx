import { HomePage } from "@/components/home-page";
import { getMediaForPage } from "@/lib/db/data";

export default async function Page() {
  return <HomePage initialItems={await getMediaForPage()} />;
}
