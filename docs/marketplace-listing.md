# Deploy and Host Payload CMS 3 Production Ready on Railway

Payload CMS 3 Production Ready is a zero-config, Railway-native foundation for building with Payload. It deploys Payload CMS with PostgreSQL, persistent media storage, production migrations, and health checks already wired together. The starter stays intentionally minimal — just Users and Media — so you can build your schema instead of removing someone else's.

## About Hosting Payload CMS 3 Production Ready

Payload 3 runs inside Next.js and needs more than a database to be production-ready. Uploaded files need durable storage outside the application container, database schema changes need controlled migrations, and all services need to be connected correctly.

This template handles that infrastructure for you. Railway provisions PostgreSQL and a Storage Bucket, connects them automatically over the appropriate Railway networking, generates the Payload secret, and configures the application with no deploy-form setup required.

Migrations run before the server starts, and uploaded media is stored in the Railway Bucket rather than the ephemeral application filesystem.

## Common Use Cases

- **Headless CMS backend** for web or mobile applications using Payload's REST or GraphQL APIs
- **Application back office** where editors manage the same structured data your product consumes
- **Foundation for a custom Payload project** with your own collections, access control, hooks, jobs, and integrations
- **CMS for a separately deployed frontend**, whether hosted on Railway or elsewhere

## Dependencies for Payload CMS 3 Production Ready Hosting

- **PostgreSQL** — provisioned automatically and connected to Payload over Railway's private network
- **Railway Storage Bucket** — provisioned automatically for persistent media uploads across deployments and restarts

Both services are created and connected automatically. There are no credentials to copy and nothing to fill in on the deploy form. Database and bucket credentials are wired using Railway variable references, and `PAYLOAD_SECRET` is generated automatically.

### Implementation Details

#### Production-safe migrations

Database migrations run before the application server starts:

```bash
node scripts/migrate.mjs
exec next start -H 0.0.0.0 -p "${PORT:-3000}"
```

The migration runner waits for PostgreSQL to become available and uses a PostgreSQL advisory lock before applying migrations. This prevents multiple application replicas from attempting to apply the same migration concurrently.

If a migration fails, the deployment fails instead of starting the application against an incompatible database schema.

#### Persistent private media

Railway Storage Buckets are private. Uploaded files are streamed through Payload at:

```text
/api/media/file/{filename}
```

This means media access remains under Payload's access-control system rather than requiring a publicly exposed storage bucket.

#### Adding your own schema

The template intentionally includes only `Users` and `Media`. Add collections using the normal Payload workflow, then generate types and create a migration:

```bash
pnpm generate:types
pnpm migrate:create
```

Commit the generated migration with your schema changes. It will be applied automatically on the next deployment.

Local development uses PostgreSQL in Docker and stores uploads locally, so Railway Bucket credentials are not required on your development machine.

## Why Deploy Payload CMS 3 Production Ready on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Payload CMS 3 Production Ready on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
