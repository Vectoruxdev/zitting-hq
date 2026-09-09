"use client";
import { Button } from "@/ui";

export function RetryButton() {
  return <Button iconLeft="refresh-cw" onClick={() => window.location.replace(document.referrer && new URL(document.referrer).origin === location.origin ? document.referrer : "/")}>Try again</Button>;
}
