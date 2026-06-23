# Contributing to Prospex

Thank you for your interest in contributing to Prospex — the open-source AI GTM automation platform!

## Getting Started

### Prerequisites

- Node.js 22 LTS
- pnpm 9+ — `npm install -g pnpm`
- Docker Desktop (for PostgreSQL + Redis)

### Local Setup

```bash
git clone https://github.com/asiifdev/business-leads-ai-automation.git
cd business-leads-ai-automation

pnpm install

# Copy and configure env
cp .env.example apps/api/.env
cp .env.example packages/database/.env
# Edit apps/api/.env with DATABASE_URL, JWT_SECRET, OPENAI_API_KEY

# Start infrastructure
docker compose up -d

# Push database schema
pnpm --filter @prospex/database db:push

# Start dev servers
pnpm --filter @prospex/api dev      # API on :3001
pnpm --filter @prospex/web dev      # Dashboard on :3000
```

Swagger docs: `http://localhost:3001/api/docs`

## Project Structure

```
apps/
├── api/         # NestJS 10 REST API
├── web/         # Next.js 16 dashboard
└── marketing/   # Landing page
packages/
├── database/    # Prisma schema
└── types/       # Shared TypeScript types
```

## What We Welcome

- Bug fixes
- New integrations (WhatsApp, Gmail, Telegram, webhook)
- UI improvements
- Performance optimizations
- Documentation improvements
- Tests

## What We Don't Accept

- Features designed for spam or bulk unsolicited messaging
- Bypassing rate limits or ToS of scraped services
- Privacy-violating data collection

## Development Guidelines

### Code Style

- TypeScript everywhere — no `any` unless absolutely unavoidable
- NestJS conventions for backend (services, controllers, DTOs)
- React Server Components where possible in Next.js
- Tailwind CSS + shadcn/ui for UI components

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(leads): add bulk CRM status update
fix(auth): handle expired JWT gracefully
docs: update quickstart in README
```

### Before Opening a PR

1. Run `pnpm --filter @prospex/api exec tsc --noEmit` — zero TS errors
2. Run `pnpm --filter @prospex/web exec tsc --noEmit` — zero TS errors
3. Test the happy path manually in the browser
4. Update `docs/USER_GUIDE.md` if you changed user-facing behavior

## Pull Request Template

```markdown
## What does this PR do?

Brief description.

## Type
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation

## Testing
- [ ] Tested locally end-to-end
- [ ] TypeScript check passes
- [ ] No breaking changes to existing API

## Screenshots (if UI change)
```

## Reporting Issues

Include:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version, OS
- Relevant logs or screenshots

For security vulnerabilities, email directly rather than opening a public issue.

## Code of Conduct

Be respectful, constructive, and inclusive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

---

**Every contribution, big or small, makes Prospex better for business owners worldwide. Thank you!**
