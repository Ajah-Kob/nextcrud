# AGENTS.md

Comprehensive reference for AI agents working in this repository. Read this before making changes.

---

## Project Identity

**nextcrud** — A production-ready Next.js 16 full-stack CRUD boilerplate.
Includes: JWT authentication, user management with roles, file uploads, email, and paginated data tables.
Deployed to Vercel; data on Neon PostgreSQL; media on Vercel Blob.

---

## Tech Stack (exact versions — do not assume older APIs)

| Layer | Package | Version |
|---|---|---|
| Framework | `next` | 16.2.4 |
| React | `react` / `react-dom` | 19.2.x |
| Auth | `next-auth` | 4.24.x |
| ORM | `prisma` / `@prisma/client` | 7.x |
| DB driver | `@neondatabase/serverless` | 1.x |
| Prisma adapter | `@prisma/adapter-neon` | 7.x |
| File storage | `@vercel/blob` | 2.x |
| State | `zustand` | 5.x |
| Email | `nodemailer` | 7.x |
| Toasts | `sonner` | 2.x |
| Icons | `lucide-react` | 1.x |
| CSS | `tailwindcss` | 4.x (PostCSS integration, no config file) |
| TypeScript | `typescript` | 6.x |

**TypeScript strict mode is OFF** — `"strict": false` in tsconfig. Do not add `!` non-null assertions or overly defensive types that only exist to satisfy strict checks that aren't enabled.

---

## Repository Layout

```
app/                    # Next.js App Router routes
  api/auth/[...nextauth]/route.ts   # NextAuth handler (GET + POST)
  dashboard/            # Protected pages (require auth)
    layout.tsx          # Uses Dashboard template
    page.tsx            # Dashboard home
    users/page.tsx      # Paginated user management table
    user/
      profile/page.tsx  # Edit own profile
      security/page.tsx # Change own password
  login/                # Public auth pages
  signup/
  forgot-password/
  reset-password/
  layout.tsx            # Root layout (fonts, Sonner, Providers, HydrationZustand)
  providers.tsx         # <SessionProvider> wrapper

components/
  forms/                # All form components (Login, Signup, Profile, Security, etc.)
  globals/              # Layout-level UI (Header, Footer, Aside, Drawer, etc.)
  users/UsersTable.tsx  # Paginated user list table
  ButtonsAuth.tsx
  Icons.tsx
  ui/ButtonDrawer.tsx

config/
  constants.ts          # APP_NAME, APP_BASE_URL, SMTP constants, USERS_PER_PAGE

lib/
  authOptions.ts        # NextAuth config (Credentials, JWT, session callbacks)
  prisma.ts             # Prisma singleton with Neon adapter
  helper.tsx            # Utility functions (isValidEmail)
  actions/
    user.ts             # User CRUD server actions
    me.ts               # Authenticated-user server actions
    media.ts            # Vercel Blob upload/delete
    util.ts             # Password reset + email

prisma/
  schema.prisma         # DB schema
  seed.ts               # Seeds default admin user
  migrations/           # Applied migration files

store/
  useAside.ts           # Sidebar minimized state (Zustand)
  useDrawer.ts          # Mobile drawer open state (Zustand)

templates/
  Default.tsx           # Public layout (Header + main + Footer)
  Dashboard.tsx         # Dashboard layout (Aside + HeaderDashboard + main + Footer)
  Blank.tsx             # Bare layout (main only)
  hydrationZustand.tsx  # SSR hydration fix for Zustand

types/                  # Shared TypeScript type definitions
```

---

## Database Schema

### User

```prisma
model User {
  id          Int       @id @default(autoincrement())
  name        String?
  email       String    @unique
  image       String?
  role        Role      @default(USER)
  password    String?
  activatedAt DateTime?
  loggedInAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?             // soft-delete field

  @@index([email, deletedAt])
}

enum Role {
  SUPERADMIN
  ADMIN
  USER
}
```

### ResetPasswordToken

```prisma
model ResetPasswordToken {
  id         Int      @id @default(autoincrement())
  email      String
  token      String   @unique
  expires    DateTime
  created_at DateTime @default(now())

  @@unique([email, token])
}
```

**Critical conventions:**
- **Always filter `deletedAt: null`** when querying active users. Never skip this — soft-deleted users must remain invisible to the app.
- Role hierarchy (highest → lowest): `SUPERADMIN` → `ADMIN` → `USER`.
- Passwords hashed with `bcrypt` — **10 rounds** in `prisma/seed.ts`, **12 rounds** in all server actions. Use 12 for new code.

### Seed defaults

```
email:    admin@domain.com
password: defaultpass
role:     SUPERADMIN
```

Run `npm run db:seed` to (re)create this account via upsert. The seed script uses a plain `new PrismaClient()` — not the singleton from `lib/prisma.ts` — because it runs outside the Next.js runtime.

---

## Authentication

**Library:** NextAuth.js v4 (NOT v5 / Auth.js — APIs differ).

**Strategy:** JWT sessions (no DB session table). Session max age: 1 day.

**Sign-in page:** `/login`

### How auth data flows

1. User submits credentials → `FormLogin` calls `signIn('credentials', ...)`
2. NextAuth `authorize()` in `lib/authOptions.ts`:
   - Finds user by email where `deletedAt: null`
   - Verifies password with `bcrypt.compare`
   - Updates `loggedInAt` timestamp
   - Returns `{ id, name, email }`
3. `jwt` callback enriches token: fetches full user from DB, adds `id`, `name`, `email`, `image`, `role`
4. `session` callback maps token fields onto `session.user`
5. Client reads session via `useSession()` hook (requires `<SessionProvider>` from `app/providers.tsx`)
6. Server reads session via `getServerSession(authOptions)`

### Session update flow

When a user updates their own profile (`updateMe`), the client calls `update()` from `next-auth/react`. The `jwt` callback detects `trigger === 'update'` and overwrites the token with the new values from `session`.

### Accessing session on the server

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

const session = await getServerSession(authOptions)
if (!session) redirect('/login')
const userId = session.user.id
const userRole = session.user.role
```

### Accessing session on the client

```typescript
'use client'
import { useSession } from 'next-auth/react'

const { data: session } = useSession()
```

---

## Server Actions

All actions live in `lib/actions/`. All files begin with `'use server'`.

### Response shape convention

Actions return a plain object — never throw. Common shape:

```typescript
{ success: boolean; message: string; payload?: any }
```

Form-bound actions receive `(_prevState: any, formData: FormData)` as arguments (compatible with `useActionState` / `useFormState`).

### user.ts — User CRUD (admin operations)

| Function | Purpose | Cache |
|---|---|---|
| `getUser(id)` | Fetch one user by ID | `'use cache'`, tagged `user-${id}` |
| `getUsers(page?, perPage?)` | Paginated list of non-deleted users | `'use cache'`, tagged `users` |
| `createUser(_prev, formData)` | Create user; revalidates `users` tag | mutation |
| `softDeleteUser(id)` | Sets `deletedAt = now()`; revalidates | mutation |
| `updateUser(_prev, formData)` | Update name/email/role; revalidates | mutation |

### me.ts — Current user operations

| Function | Purpose | Cache |
|---|---|---|
| `getMe()` | Fetch authenticated user | `react cache()` (per-request dedup) |
| `updateMe(_prev, formData)` | Update own name/email/image; triggers session update | mutation |
| `updateMePassword(_prev, formData)` | Verify current password, set new hash | mutation |

### media.ts — File storage

| Function | Purpose |
|---|---|
| `uploadMedia(userId, imageFile)` | Uploads to Vercel Blob at path `user/{userId}/{random}-{filename}`, returns new URL |
| `deleteMedia(_prev, formData)` | Deletes blob URL passed in formData |

Blob domain `tosysoik0rjt4ojn.public.blob.vercel-storage.com` is allowlisted in `next.config.ts` for `<Image>`.

### util.ts — Auth utilities

| Function | Purpose |
|---|---|
| `forgotPassword(_prev, formData)` | Creates `ResetPasswordToken`, sends reset email via Nodemailer/Brevo |
| `resetPassword(_prev, formData)` | Validates token, hashes new password, deletes used token |

---

## Caching Strategy

This project uses **Next.js 16 Cache Components** (`cacheComponents: true` in `next.config.ts`).

**`'use cache'` directive** — applied at the function level inside server actions for read queries:

```typescript
'use server'
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache'

export async function getUsers(page = 1, perPage = USERS_PER_PAGE) {
  'use cache'
  cacheTag('users')
  cacheLife('max')
  // ... prisma query
}
```

**Invalidation after mutations:**

```typescript
import { revalidateTag } from 'next/cache'
revalidateTag('users')          // bust all users list caches
revalidateTag(`user-${id}`)     // bust single user cache
```

**`react cache()`** is used in `me.ts` for request-level deduplication (not HTTP cache):

```typescript
import { cache } from 'react'
export const getMe = cache(async () => { ... })
```

Do not mix up these two caching mechanisms. `'use cache'` is persistent across requests; `react cache()` lives for one request only.

---

## State Management

Zustand stores are **client-only UI state** — they do not hold server data.

| Store | State | Used by |
|---|---|---|
| `useAside` | `minimized: boolean` + `toggleMinimized()` | Sidebar collapse |
| `useDrawer` | `isOpen: boolean` + `open()` + `close()` | Mobile drawer |

**SSR hydration:** Wrap any component reading Zustand state in `<HydrationZustand>` (from `templates/hydrationZustand.tsx`) to prevent hydration mismatch. The dashboard `layout.tsx` handles this at the template level — individual components do not need it.

---

## Routing & Templates

| Route | Protection | Template |
|---|---|---|
| `/` | Public | `Default` (Header + Footer) |
| `/login`, `/signup`, etc. | Public (redirect if authed) | `Blank` |
| `/dashboard/*` | Auth required | `Dashboard` (Aside + HeaderDashboard + Footer) |

**No middleware.ts exists.** Route protection is handled inside each page component using `getServerSession()`.

---

## Environment Variables

All vars loaded from `.env.local` (pulled via `vercel env pull .env.local`).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Neon connection — used by Prisma at runtime |
| `DATABASE_URL_UNPOOLED` | Direct Neon connection — used by Prisma CLI for migrations |
| `NEXTAUTH_SECRET` | JWT signing key |
| `NEXTAUTH_URL` | Base URL for NextAuth callbacks |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob API token |
| `SMTP_HOST` | Brevo SMTP server hostname |
| `SMTP_KEY` | Brevo SMTP API key |

Constants derived from env/config live in `config/constants.ts`: `APP_NAME`, `APP_BASE_URL`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`, `USERS_PER_PAGE`.

---

## Common Patterns

### Adding a new server action

```typescript
'use server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

export async function myAction(_prevState: any, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session) return { success: false, message: 'Unauthorized' }

  // ... logic

  return { success: true, message: 'Done' }
}
```

### Adding a new protected page

```typescript
// app/dashboard/something/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'

export default async function SomethingPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  // fetch data, render
}
```

### Using a form with server action

Client form components use `useActionState` (React 19) or `useFormState` (React 18 compat):

```typescript
'use client'
import { useActionState } from 'react'
import { myAction } from '@/lib/actions/something'

const [state, formAction, isPending] = useActionState(myAction, null)
```

### Querying users (always filter soft deletes)

```typescript
await prisma.user.findMany({
  where: { deletedAt: null },
})
```

---

## Testing

Run with: `npm run test` (Jest).

Test files follow the standard Jest convention. TypeScript strict mode is off, so tests do not need full type coverage. There are no existing test files in the repo — add tests alongside the code they cover.

---

## Build & Deployment Notes

- **Build command override for Vercel:** `prisma generate && next build` (documented in README).
- `npm run dev` starts Next.js with Turbopack.
- Server Actions body limit is 2 MB (set in `next.config.ts` under `experimental.serverActions`).
- `devIndicators: false` suppresses the Next.js dev overlay badge.
- Node.js 22.14.x is required (per README).

---

## Key Gotchas

1. **Soft deletes are mandatory.** Every Prisma query on `User` must include `where: { deletedAt: null }` unless intentionally querying deleted users.
2. **next-auth v4 only.** Do not use Auth.js / next-auth v5 APIs. `authOptions` is imported from `lib/authOptions.ts`, not auto-discovered.
3. **Tailwind 4 has no config file.** Utility classes are resolved via PostCSS. Do not create `tailwind.config.js/ts`.
4. **`@/` resolves to the repository root**, not `src/`. Imports like `@/lib/...`, `@/components/...`, `@/store/...` are all from root.
5. **Session update requires calling `update()` on the client** after `updateMe` mutates the DB — the JWT is not automatically refreshed.
6. **`react cache()` vs `'use cache'`:** `getMe()` uses `react cache()` for per-request dedup only. List/detail queries use `'use cache'` with tags for persistent caching and tag-based revalidation.
7. **Prisma 7 with Neon adapter** — always use the singleton from `lib/prisma.ts`. Never instantiate `PrismaClient` directly in a component or action.
8. **No middleware.ts** — there is no global route guard. Each dashboard page must call `getServerSession()` itself.
