import { FinancePage } from "./finance-page";

// Server actions inherit this segment config — the manual "Sync now" action
// needs the same headroom as the cron sync (slow bank pulls).
export const maxDuration = 300;
export const metadata = { title: "Finance · Zitting HQ" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ as?: string; tab?: string }> }) {
  return <FinancePage section={null} searchParams={await searchParams} />;
}
