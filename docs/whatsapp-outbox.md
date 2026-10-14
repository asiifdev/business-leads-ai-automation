# WhatsApp and the Outbox

How a message travels from a draft to a customer's phone, and what Prospex does at each step to keep your number safe.

## The lifecycle of a message

```
            write            approve              claim               send
 (AI) ──► draft ──────► approved ──────► sending ──────► sent
            │              │                │
            │ reject       │ cancel         ├─► failed   (retry by hand)
            ▼              ▼                └─► approved (connection was down: back in line)
         rejected       cancelled
```

Every message begins as a **draft**. Three things create drafts, and all three need your approval:

| Source | Created when |
|--------|--------------|
| `ai_outreach` | You click **Write drafts** for a campaign, or create drafts from **One message for many leads** (the draft's context says `template: true`). |
| `ai_reply` | A known lead writes back (not an automatic greeting). |
| `ai_followup` | A contacted lead has stayed silent for 3 days (first follow-up) or 5 more days (second). At most two follow-ups per lead. |

Nothing is sent from a draft. **Approve** moves it to the queue, and the sender takes it from there.

## What the sender checks before each message

The sender wakes every 15 seconds and handles one account at a time. A message goes out only when every check passes, in this order:

1. Sending is not paused.
2. It is outside quiet hours (default 21:00 to 07:00 in the account's timezone).
3. Today's count is under the daily cap (default 80).
4. This hour's count is under the hourly cap (default 10).
5. The random gap since the last message has passed (0.6x to 1.4x of `3600 / hourlyLimit` seconds, so about 3.6 to 8.4 minutes at 10 per hour).

Then, for the oldest approved message:

6. It is claimed atomically (`approved` to `sending`), so two workers can never send the same message.
7. The recipient has not opted out since approval.
8. The number is on WhatsApp. If it is not, the message fails with "Number is not on WhatsApp" and the account's failure counter is untouched.
9. "Typing…" is shown for a time proportional to the message length (1.5 to 9 seconds), then the message is sent.
10. The lead moves from `new` to `contacted`, `contactedAt` is set, and an activity entry is written.

## When things go wrong

| Situation | What happens |
|-----------|--------------|
| WhatsApp is disconnected | The message returns to the queue and waits. No attempt is counted. |
| A send throws an error | Retried up to 3 times, 5 minutes apart, then marked failed. |
| 3 sends fail in a row | The account is **paused automatically** with the last error shown. Resume it yourself after checking. |
| The server restarts during a send | The message is marked failed with "Interrupted while sending". It may already have been delivered, so it is never resent automatically. Check WhatsApp, then retry by hand if needed. |
| You are logged out from the phone | The session is deleted, sending is paused, and the Outbox asks you to link the number again. |
| The connection drops | Reconnects with exponential backoff, up to 8 times, then stops and shows the error. |

## When someone replies

WhatsApp increasingly addresses chats with an opaque `@lid` identifier instead of the phone number. Prospex reads the real number from the message's `senderPn` field, so replies are matched by phone number as before. (A real test found this: replies were silently dropped until the fix.)

Incoming text messages are stored and matched to a lead by phone number. Then:

- **STOP, berhenti, unsubscribe and similar**, including inside a short sentence ("Maaf kak belum ya STOP", "ok stop"; people answer our own "balas STOP" line this way; a message longer than 80 characters needs one of the stricter phrases): the number is added to the opt-out list, its pending drafts and approved messages are cancelled, and it is never messaged again, even if you approve something later.
- **STOP** also closes the lead as lost ("Meminta berhenti (STOP)"), the one reply that closes a deal by itself.
- **Quick first answers** (within 45 seconds of our message, no clear question such as price or interest) are treated as automatic too: a person rarely replies that fast.
- **A shop's automatic greeting** ("Terima kasih telah menghubungi…", "mohon menunggu", opening hours, long canned menus) is recognised by rules and only recorded: no stage change, follow-ups stay, no reply draft.
- **What the reply does is planned in code**, not left to the model: thanks and goodbye, "I will pass it to my superior" and "later" get fixed polite wording; price questions and interest get a model-written one or two sentences limited to your facts, checked afterwards (no second introduction, no emoji, no commands, no invented links) and replaced by safe wording if it fails twice.
- **Captions and shared contacts are read.** A photo or document with a caption counts as a reply with that text; a shared contact card is read as `[Kontak: name +number]`. A picture or file with no words is not a reply.
- **What they "just said" is everything written together.** Bubbles within 3 minutes of each other are answered as one; a shop's automatic messages and older chat are history, never part of it (`thread.ts`).
- **Pointed to another contact** ("contact our management", a shared contact card) is its own kind of reply: the draft is a fixed thank-you chosen in code (or a request for the number), the contact is kept in the lead's activity log, and "Add as a lead" creates it once.
- **Any other reply from a known lead**: its meaning is classified by rules (interested, wants a meeting, asked the price, question, not now, not interested), the lead moves forward (never backward), is flagged as waiting for you, pending follow-ups are cancelled, and a **reply draft** appears in your Review tab with the customer's message quoted above it. If they asked for time, a follow-up date is set 30 days out.
- **A message from an unknown number**: stored, never answered. If WhatsApp hid the sender's number (an `@lid` address without `senderPn`), the message is kept under `lid:<id>` and listed on the Pipeline page under "Messages from unknown senders"; it cannot be matched to a lead, so a STOP from one has to be handled by hand.

Replies are drafted in your voice's spelling and warmth with the same knowledge base and style as first messages, but with the right role: the sender is a business you approached, so the draft is polite and humble, gives no commands ("kabari saja ya"), has no emoji and no guessed honorific (Mbak, Mas, Bapak, Ibu become "Kak"). Your chats are with your own customers, where you are the one serving, so copying their attitude would sound like a boss to a stranger. Because a customer's text is untrusted input, it is wrapped in delimiters and the model is told to treat it as data. A draft that contains links, prices, discounts or bank details that your knowledge base does not support, or a customer message that looks like instructions to the AI, is flagged in the Outbox so you read it twice before approving.

## Messages you type on your own phone

Many owners answer straight from their phone or WhatsApp Web. Prospex hears about those messages and records them, **only when the number belongs to a lead**; a message to any other number is ignored and never stored. A message Prospex sent itself is recognised (same WhatsApp id, or the same text within 10 minutes) and not recorded twice.

When one is recorded: it is stored as a sent message with the source "external", the lead stops waiting for an answer, `contactedAt` moves forward, drafts for follow-ups and replies that were waiting are withdrawn ("Answered from the phone"), pending follow-up timing restarts, and the next draft sees what you said because the conversation includes it. These messages do not count toward the hourly and daily limits. A photo, file or voice note with no words is stored as a marker such as `[Dokumen: name.pdf]`. The history WhatsApp replays when a device links is not imported.

## Reply drafts never go stale

A draft is written about 20 seconds after the prospect's last bubble (`REPLY_DRAFT_DELAY_MS`), so a burst of short messages gets one draft that covers all of it. It is skipped if you have already answered, and a new draft replaces any older waiting one. The pipeline page's "Re-read conversations" button applies the same rules to old conversations: it previews what would change (labels, who is waiting, outdated drafts) and applies only when you confirm.

## Formatting, files and link previews

- **Formatting.** WhatsApp's own syntax is kept: `*bold*`, `_italic_`, `~strike~`, `- ` lists and blank lines between paragraphs. Markdown a model writes is converted and unbalanced symbols are removed. The Outbox shows each message as a WhatsApp bubble.
- **Files.** Upload a PDF, JPG, PNG, WebP, MP4, DOCX, XLSX or PPTX (up to 16 MB). The type is read from the file's first bytes, never from its name. The message text is the file's caption; WhatsApp shows at most 1,024 characters of a caption, so a longer text is sent as its own message right after the file. Files are stored under `ATTACHMENTS_DIR`, one folder per workspace, under a generated name. A file that a waiting message still uses cannot be deleted, a file already sent stays in the history, and a message whose file is missing fails instead of being sent without it. The official Cloud API connection refuses files.
- **Link previews.** A link in the text gets a card (title, description, picture) built by fetching the page through the same safe fetcher as website reading (public addresses only, redirects re-checked, size and time limits); Baileys' own preview builder is not used. You see the card before approving it, it is on by default when a link is present, and a page that cannot be read simply goes out without a card. A short text sent as a file's caption has no card.

## Connecting a number

Click **Connect WhatsApp** in the Outbox and scan the code: WhatsApp, Settings, Linked devices, Link a device. Prospex connects as a linked device (Baileys) and does not mark itself online, so your phone keeps notifying you.

Sessions are stored in `WA_AUTH_DIR` (default `./.wa-auth`). Keep that directory on a persistent volume and treat it like a password: anyone holding it can act as your WhatsApp. After a restart, Prospex reconnects the sessions that were linked.

## Choosing your pace

| Daily cap | Hourly cap | 1,500 leads take |
|-----------|-----------|------------------|
| 80 (default) | 10 | about 19 days |
| 140 | 10 | about 11 days |
| 80 | 6 | about 19 days (the daily cap decides) |
| 200 (the maximum) | 20 | about 5 days for 1,000 leads (14 hours a day x 20 = 280, so the daily cap decides) |

The API accepts 1 to 30 per hour and 1 to 200 per day. At 20 per hour a message leaves about every three minutes, so a long queue is slow by design.

Guidance that applies to any WhatsApp automation:

- **Use a dedicated business number.** Never the number you cannot afford to lose.
- **Warm up.** Start at 5 to 10 per hour for the first days and raise the limits only while replies keep coming.
- **Start small.** Send 30 to 50 and look at the reply rate before the full list.
- **Do not send identical text.** Drafts are written per lead for this reason. Edit the ones that read generic. **One message for many leads** sends the same text to everyone you pick, so use `{nama}`, keep each batch small, and spread batches over days.
- **Say who you are in the first sentence.** In a real test, messages that opened with a clever question and no introduction were taken for customers asking to rent, and a few got STOP.
- **Watch for signals.** Few replies, many "not on WhatsApp" results, or being logged out all mean slow down.
- **Honour STOP.** Prospex does this for you. The opt-out line is added to every first message and follow-up.

## Linked device and the official API

| | Linked device (Baileys) | Official WhatsApp Business Cloud API |
|---|---|---|
| Status in Prospex | Available | Planned |
| Setup | Scan a code | Business verification and message templates |
| Cost | Free | Per-conversation pricing |
| Ban risk | Higher: unofficial, so a dedicated number is essential | Lower: it is the sanctioned channel |
| Cold first messages | Possible | Must use pre-approved templates |

The sender talks to WhatsApp through a single `WhatsappProvider` interface (`apps/api/src/messaging/whatsapp.provider.ts`): connect, disconnect, resolve a number, send, and a callback for incoming messages. Adding the Cloud API means writing one more class that implements it. The queue, the limits and the approval flow stay the same.

## Legal

Messaging people is regulated: consent and opt-out rules (GDPR, Indonesia's UU PDP, anti-spam laws), and WhatsApp's own terms. Prospex gives you the tools (approval, opt-out, pacing) but compliance is your responsibility. This is not legal advice. See [DISCLAIMER.md](../DISCLAIMER.md).

## Replies skip the queue

An approved answer to someone who wrote to you (`ai_reply`) is sent on the next sender tick, ahead of the cold messages. It does not wait for the hourly or daily limit, the pause between messages or quiet hours, it does not count toward those limits, and it does not delay the cold messages behind it. A paused account, an opt-out and a disconnected number still stop it. Typing time is still simulated before it goes out.
