import type { Metadata } from "next";
import { OutboxPage } from "@/components/outbox/outbox-page";

export const metadata: Metadata = { title: "Outbox | Prospex" };

export default function Page() {
  return <OutboxPage />;
}
