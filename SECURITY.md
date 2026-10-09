# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Email **admin@asiifdev.com** with a description, steps to reproduce and the affected version. You will get a reply within 5 working days.

## Scope

Prospex stores third-party API keys (AES-256-GCM encrypted with `ENCRYPTION_KEY`) and lead and chat data. Reports about authentication, tenant isolation, key handling, injection (including prompt injection through scraped listings, customer replies or exported chats) and unsafe file parsing are especially welcome.

Also in scope: WhatsApp linked-device sessions (`WA_AUTH_DIR`). Anyone who can read that directory can act as the linked number, so keep it on a private volume with restricted permissions.

## Supported versions

Only the latest release on `main` receives security fixes.
