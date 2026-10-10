# Email channel

Prospex can send first emails through your own SMTP account, with the same rule as WhatsApp: **nothing goes out without your approval**, and approved messages leave one at a time at a pace you set.

## What it does

1. **You connect an SMTP account** (Outbox → Email → Set up email): server, port, login, sender name and address, and the postal address printed at the bottom of every message. The password is stored encrypted (AES-256-GCM, `ENCRYPTION_KEY`) and is never sent back to the browser. *Test the connection* logs in without sending anything.
2. **Leads get an address from their own website.** [Contact enrichment](features.md#2-find-and-rank-prospects) reads each lead's site and stores the emails printed there. Prospex never guesses an address.
3. **The AI writes a draft and a subject** for each lead with an address, using the same inputs as WhatsApp drafts (the lead's real data, your Marketing Brief, your knowledge base, your style) but in email form: a longer message, no "Kak", no "reply STOP" line, and a plain, specific subject.
4. **You review, edit (subject and body) and approve.**
5. **The sender delivers** with hourly and daily caps (default 8 and 40), quiet hours (default 20:00 to 07:00), random gaps, and a circuit breaker (three failures in a row pause the account). A message interrupted mid-send is marked failed and never resent automatically.

## Every email carries a way out

- A footer with the sender's name, the postal address and an unsubscribe link, and `List-Unsubscribe` plus `List-Unsubscribe-Post` headers (one-click unsubscribe in mail apps).
- The link opens a confirmation page. **Opening it changes nothing**, because mail scanners and previews open links. Only pressing the button (or a mail app's one-click request) records the opt-out. The token is signed, so addresses cannot be unsubscribed by guessing.
- An opt-out is absolute: it is checked when you approve and again when the message is sent, and it withdraws any drafts waiting for that address.

The unsubscribe link needs a public address for your API. Set `PUBLIC_API_URL` (for example `https://api.example.com/api`). The default points at localhost, which only works for you.

## Safety choices

- **The mail server name is user input**, so it is treated like any user-supplied address: it must resolve to public addresses only, the name is resolved once and the connection goes to that address (TLS is still checked against the original name), and only ports 25, 465, 587 and 2525 are allowed. A self-hosted mail relay on a private network needs `EMAIL_ALLOW_PRIVATE_SMTP=true`.
- **No clear-text login.** On a non-"secure" port the connection must upgrade to TLS (STARTTLS) or it fails.
- **Header injection.** Subject and sender name are flattened to one line.
- **Permanent refusals** (a 5xx from the server for a recipient) fail that message only and do not count against the account. A wrong login stops sending until you fix it.

## Configuration

| Variable | Meaning |
|----------|---------|
| `PUBLIC_API_URL` | Public base URL of the API, used in unsubscribe links |
| `EMAIL_DISABLED` | `true` turns the email sender off (CI uses it) |
| `EMAIL_ALLOW_PRIVATE_SMTP` | `true` allows an SMTP server on a private address |

## Verified, and what is not

**Verified** against a local SMTP server that requires TLS and a login: saving and testing the account (wrong password and a forbidden port are refused with a clear message, the password never appears in a response), sending (STARTTLS, correct sender, footer, unsubscribe headers, a hostile subject flattened), pacing, a permanent refusal that does not pause the account, the unsubscribe page and one-click request, opt-out checks at draft, approve and send, an AI-written draft and subject, and the Outbox screens on a phone-sized window.

**Not verified:** a real provider (Gmail, Zoho, SES and others differ in limits, app passwords and spam filtering), deliverability and inbox placement, and sending at volume.

## Not built

- **Reading replies.** Replies land in your own mailbox; Prospex does not read them, so there is no reply draft and no automatic status change.
- **Email follow-ups** (WhatsApp has them).
- **Bounce handling** beyond the server's immediate refusal.
- **Domain setup help.** SPF, DKIM and DMARC are your responsibility; without them cold email is likely to land in spam. Send from a domain you can afford to damage, and keep volume low at first.
- A legal review. Rules on unsolicited commercial email differ by country (CAN-SPAM, GDPR and ePrivacy, Indonesia's PDP law). The footer and unsubscribe are the mechanics; whether you may email a given business is for you to check.
