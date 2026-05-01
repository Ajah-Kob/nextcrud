# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Next.js dev server with Turbopack

# Build & lint
npm run build
npm run lint

# Tests
npm run test

# Database (Prisma + Neon PostgreSQL)
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Create and apply a new migration (append --name <name>)
npm run db:push      # Push schema changes without migration (dev only)
npm run db:reset     # Drop and recreate DB, re-run all migrations + seed
npm run db:seed      # Seed DB with default admin user
npm run db:studio    # Open Prisma Studio UI
npm run db:deploy    # Apply pending migrations (production)
```

## Architecture

**Next.js 16 App Router** full-stack CRUD boilerplate with authentication, user management, file uploads, and email.

### Data flow

- **Pages** live in [app/](app/) using the App Router. Protected routes live under [app/dashboard/](app/dashboard/).
- **Server Actions** in [lib/actions/](lib/actions/) handle all mutations (`me.ts` for current user, `user.ts` for user CRUD, `media.ts` for file uploads, `util.ts` for password reset/email).
- **Auth** is NextAuth.js 4 (Credentials provider, JWT sessions) configured in [lib/authOptions.ts](lib/authOptions.ts). Session data flows: JWT callback enriches token → session callback populates `session.user`.
- **Database** is Neon PostgreSQL via Prisma 6. The singleton client is in [lib/prisma.ts](lib/prisma.ts). Schema lives in [prisma/schema.prisma](prisma/schema.prisma).
- **File storage** uses Vercel Blob (`@vercel/blob`), accessed through the `media.ts` server action.
- **Email** is sent via Nodemailer + Brevo SMTP. Templates are in [lib/email-templates/](lib/email-templates/).

### State management

Zustand is used for UI-only client state (sidebar, drawer, dark/light mode). Stores are in [store/](store/). The [templates/hydrationZustand.tsx](templates/hydrationZustand.tsx) wrapper prevents SSR hydration mismatches.

### Key conventions

- `User` model has a `deletedAt` soft-delete field — always filter `deletedAt: null` when querying active users.
- `User.role` is an enum: `SUPERADMIN | ADMIN | USER`.
- TypeScript strict mode is **off** in this project (`"strict": false` in tsconfig).
- Path alias `@/` maps to the repository root.
- `next.config.ts` sets `serverActions.bodySizeLimit: 2mb` and allowlists the Vercel Blob storage domain for `<Image>`.

### Environment variables

Key vars (loaded from `.env.local`):
- `DATABASE_URL` — pooled Neon connection (for runtime queries)
- `DATABASE_URL_UNPOOLED` — direct connection (for Prisma migrations)
- `NEXTAUTH_SECRET` — JWT signing key
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob access
- `SMTP_HOST` / `SMTP_KEY` — Brevo email relay
