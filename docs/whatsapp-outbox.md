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
| `ai_outreach` | You click **Write drafts** for a campaign. |
| `ai_reply` | A known lead writes back. |
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

- **STOP, berhenti, unsubscribe and similar**: the number is added to the opt-out list, its pending drafts and approved messages are cancelled, and it is never messaged again, even if you approve something later.
- **Any other reply from a known lead**: the lead becomes `replied`, pending follow-ups are cancelled, and a **reply draft** appears in your Review tab with the customer's message quoted above it.
- **A message from an unknown number**: stored, never answered.

Replies are drafted in your voice with the same knowledge base and style as first messages. Because a customer's text is untrusted input, it is wrapped in delimiters and the model is told to treat it as data. A draft that contains links, prices, discounts or bank details that your knowledge base does not support, or a customer message that looks like instructions to the AI, is flagged in the Outbox so you read it twice before approving.

## Connecting a number

Click **Connect WhatsApp** in the Outbox and scan the code: WhatsApp, Settings, Linked devices, Link a device. Prospex connects as a linked device (Baileys) and does not mark itself online, so your phone keeps notifying you.

Sessions are stored in `WA_AUTH_DIR` (default `./.wa-auth`). Keep that directory on a persistent volume and treat it like a password: anyone holding it can act as your WhatsApp. After a restart, Prospex reconnects the sessions that were linked.

## Choosing your pace

| Daily cap | Hourly cap | 1,500 leads take |
|-----------|-----------|------------------|
| 80 (default) | 10 | about 19 days |
| 140 | 10 | about 11 days |
| 80 | 6 | about 19 days (the daily cap decides) |

Guidance that applies to any WhatsApp automation:

- **Use a dedicated business number.** Never the number you cannot afford to lose.
- **Warm up.** Start at 5 to 10 per hour for the first days and raise the limits only while replies keep coming.
- **Start small.** Send 30 to 50 and look at the reply rate before the full list.
- **Do not send identical text.** Drafts are written per lead for this reason. Edit the ones that read generic.
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
