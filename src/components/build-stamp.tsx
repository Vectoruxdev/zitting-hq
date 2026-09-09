import { buildLabel, buildTitle } from "@/lib/build";

/** The version line at the bottom of the app — sidebar, the phone "Everything" sheet, and the sign-in page. Hover for the full build time. */
export function BuildStamp({ align = "start" }: { align?: "start" | "center" }) {
  return (
    <div className="zh-num" title={buildTitle()} style={{ font: "var(--type-caption)", color: "var(--text-tertiary)", letterSpacing: "0.01em", padding: "8px 6px 4px", textAlign: align, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
      {buildLabel()}
    </div>
  );
}
