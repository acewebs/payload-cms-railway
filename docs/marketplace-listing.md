# Deploy and Host Payload CMS 3 Production Ready on Railway

Payload is an open-source TypeScript headless CMS with an admin panel, REST and
GraphQL APIs, and your schema defined in code. This template is the production
wiring around it: PostgreSQL, durable storage for uploads, real migrations and a
healthcheck, already connected. Users and media only, so you build your schema
rather than delete someone else's.

## About Hosting Payload CMS 3 Production Ready

Payload runs as a Next.js server, so hosting it takes more than starting a
container. It needs a database it can reach privately, somewhere durable for
uploaded files, and a way to apply schema changes before the new version serves
traffic. The last two are where self-hosted Payload usually goes wrong: a
container filesystem is ephemeral, so uploads written to disk vanish on the next
deploy, and pushing schema changes to a live database is fine in development and
dangerous in production. This template settles both. Migrations run from the
entrypoint before the server starts, so a failed migration fails the deploy
rather than leaving an app in front of a schema it does not understand.

## Common Use Cases

- A content API behind a web or mobile app, consumed over REST or GraphQL
- The back office for a product, where editors need an admin panel and your
  application needs the same data over an API
- A starting point for a custom Payload build: add collections, access control,
  hooks and background jobs on top of infrastructure that is already correct
- A headless CMS for a frontend deployed separately, on Railway or anywhere else

## Dependencies for Payload CMS 3 Production Ready Hosting

- PostgreSQL, provisioned by this template and reached over Railway's private
  network
- A Railway Storage Bucket, provisioned by this template, holding every upload
  so media survives redeploys and restarts

Both are created and connected automatically. There is nothing to fill in on the
deploy form, and no credentials to copy: the database URL and all five bucket
variables are wired as references, and the Payload secret is generated for you.

### Implementation Details

Migrations are applied by the container entrypoint, ahead of the server, and are
safe to run on more than one replica at once. The script waits for Postgres to
accept connections, since on a cold deploy the database may still be starting,
then takes a Postgres advisory lock so two replicas cannot apply the same
migration twice:

```bash
node scripts/migrate.mjs   # wait for Postgres, lock, migrate
exec next start -H 0.0.0.0 -p "${PORT:-3000}"
```

Railway buckets are private, which is a feature rather than a limitation: files
are streamed through Payload at `/api/media/file/<filename>` and governed by the
`read` access function on the media collection, so access control is yours to
tighten rather than something you have to bolt on.

Adding your own content types is the normal Payload workflow, plus one command:

```bash
pnpm generate:types      # after editing a collection
pnpm migrate:create      # commit the migration it writes
```

The deploy applies it. Local development uses a Postgres container and writes
uploads to disk, so you never need bucket credentials on your machine.

## Why Deploy Payload CMS 3 Production Ready on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Payload CMS 3 Production Ready on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
