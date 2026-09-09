import { notFound } from "next/navigation";
import { FINANCE_SECTIONS, FinancePage } from "../finance-page";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = { overview: "Overview", accounts: "Accounts", transactions: "Transactions", budgets: "Budgets", transfers: "Transfers", savings: "Savings", income: "Income & Bills", notifications: "Notifications", ask: "Ask AI", settings: "Settings" };

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return { title: `${TITLES[section] ?? "Finance"} · Zitting HQ` };
}

export default async function Page({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ as?: string; tab?: string }> }) {
  const { section } = await params;
  if (!(FINANCE_SECTIONS as readonly string[]).includes(section)) notFound();
  return <FinancePage section={section} searchParams={await searchParams} />;
}
