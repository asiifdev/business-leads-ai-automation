import { Suspense } from "react";
import type { Metadata } from "next";
import { OutboxPage } from "@/components/outbox/outbox-page";

export const metadata: Metadata = { title: "Outbox | Prospex" };

export default function Page() {
  // OutboxPage reads ?campaign= from the URL, which needs a Suspense boundary
  return (
    <Suspense fallback={null}>
      <OutboxPage />
    </Suspense>
  );
}
