-- Deleting a lead (or the campaign that holds it) deletes the messages sent to it and received from it.
-- Before, they were only detached from the lead and stayed behind. Opt-outs are separate tables and are not touched.
ALTER TABLE "outbound_messages" DROP CONSTRAINT "outbound_messages_leadId_fkey";
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbound_messages" DROP CONSTRAINT "inbound_messages_leadId_fkey";
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
