import { notFound } from "next/navigation";
import FinanceClient from "@/finance/FinanceClient";
import { AppFrame } from "@/components/app-frame";

export const metadata = {
  title: "Dev preview · Zitting HQ",
};

export const dynamic = "force-dynamic";

// Dev-only visual-QA surface: renders the finance shell with NO data prop, so
// FinanceApp falls back to the built-in MOCK_FINANCE_DATA. Used to verify nav,
// layout, themes, and mobile widths without a logged-in session. Hard-gated to
// `next dev` only — any built/deployed environment (Vercel previews included)
// runs with NODE_ENV=production and 404s. (Checking process.env.VERCEL is not
// enough locally: .env.local pulled via `vercel env pull` defines VERCEL.)
export default function DevPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  // Inside the app frame, as the owner sees it in production (?bare=1 for the
  // standalone finance shell).
  return (
    <AppFrame user={{ name: "Preview", role: "owner", person: 1 }}>
      <FinanceClient role="owner" name="Preview" embedded />
    </AppFrame>
  );
}
