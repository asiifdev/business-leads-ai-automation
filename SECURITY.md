# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Email **admin@asiifdev.com** with a description, steps to reproduce and the affected version. You will get a reply within 5 working days.

## Scope

Prospex stores third-party API keys (AES-256-GCM encrypted with `ENCRYPTION_KEY`) and lead and chat data. Reports about authentication, tenant isolation, key handling, injection (including prompt injection through scraped listings, customer replies or exported chats) and unsafe file parsing are especially welcome.

Also in scope: WhatsApp linked-device sessions (`WA_AUTH_DIR`). Anyone who can read that directory can act as the linked number, so keep it on a private volume with restricted permissions.

## What Prospex defends against

- **Server-side request forgery.** The Marketing Brief reads web pages chosen by users. Private, loopback, link-local (cloud metadata) and CGNAT addresses are refused, including names that resolve to them, at connection time and again on every redirect. The render browser runs behind a proxy that resolves each name once and connects to the checked address.
- **Hostile input.** HTML, XML, link lists and uploaded documents are processed in linear time with size caps. PDF parsing runs in a worker thread that is killed on timeout and memory-limited. DOCX files are never fully unzipped.
- **Prompt injection.** Text from outside (web pages, files, customer replies, scraped listings, exported chats) is delimited in every prompt and treated as data. Drafts are scanned for links, prices, discounts and bank details that no source supports. The Marketing Brief drops evidence that is not in the sources.
- **Unwanted messaging.** Every message needs human approval; STOP is honoured permanently; sending is paced and pauses itself after repeated failures.
- **Browser sandbox.** Chromium's sandbox is on unless `PLAYWRIGHT_NO_SANDBOX=true`, which is meant for containers only.

Known limits: linked-device WhatsApp is unofficial (see DISCLAIMER.md); the AI features read the server `.env` rather than per-workspace keys; there is no multi-user access control inside a workspace yet.

## Supported versions

Only the latest release on `main` receives security fixes.
