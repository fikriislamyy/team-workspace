# Team Workspace — agent instructions

pnpm monorepo. Node 24. All commands run in WSL2 Ubuntu at ~/code/team-workspace.

- apps/api             NestJS 11, Socket.io gateway, Prisma, Postgres, Redis
- apps/web             Next.js App Router, Tailwind, socket.io-client
- packages/shared      TypeScript types shared by both (@team-workspace/shared)

## ESM rules — apps/api is ESM, not CommonJS
- ALL relative imports must end in `.js`, even when the file is `.ts`:
  `import { AppModule } from "./app.module.js";`
- Package imports (`@nestjs/core`) do NOT get an extension.
- No `__dirname` / `__filename`. Use `import.meta.dirname`.
- Tests use Vitest, not Jest. Use `vi.fn()`, never `jest.fn()`.

## Architecture rules
- Socket event payload types are defined ONCE in packages/shared and
  imported on both sides. Never redeclare them.
- This service does NOT own users, documents, approvals, or signatures.
  Those live in a separate deployed Laravel e-sign app. We verify its
  tokens and call its REST API. We never touch its database.
- User.id in our Postgres IS the Laravel user id. Never generate it.
- Laravel state changes arrive as events, not direct calls. Handling must
  be idempotent — check ProcessedEvent before applying.
- Postgres 5433, Redis 6380. 5432/6379 belong to Laravel.

## Quality
- No `any`. No eslint/oxlint disables to make a build pass.
- Mobile-first: every component works at 375px before desktop.