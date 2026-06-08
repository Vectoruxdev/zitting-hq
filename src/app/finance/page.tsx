import FinanceClient from "@/finance/FinanceClient";
import { getFinanceData } from "@/db/queries";

export const metadata = {
  title: "Finance · Family HQ",
};

// Read live data per request when a database is configured; falls back to the
// curated mock otherwise (so it also prerenders fine with no DB).
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const data = await getFinanceData();
  return <FinanceClient data={data} />;
}
