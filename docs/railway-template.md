# Publishing this as a Railway template

Notes for whoever maintains the published template. Deploying the repo normally
needs none of this.

## Two ways in, and they do not share configuration

`.railway/railway.ts` describes the application and Postgres, and is applied with
`railway config apply`. The bucket is created by `scripts/railway-bucket.sh`,
because a `bucket()` declared in the IaC file reports "applied" and then does not
exist (Railway CLI 5.49.2), leaving every `S3_` reference resolving to an empty
string. Those five variables are marked `preserve()` in the IaC file so a later
apply does not overwrite what the script set.

Verified on a real deploy: `restartPolicyType` also silently failed to apply from
that file, though the healthcheck path did. Re-check both if you change it.

The template composer does not read it. A published template carries only what
was entered in the composer, so the settings below have to be re-entered there.
Keep the two in step: if you change a variable or the healthcheck in
`.railway/railway.ts`, change it in the composer too.

## Services

Three, created in the template composer:

1. **Payload CMS** (this GitHub repo)
2. **Postgres** (Railway's official PostgreSQL)
3. **Bucket** (Railway Storage Bucket)

The names matter, because the variable references below use them. If you rename a
service, update every reference that mentions it.

## Payload CMS service variables

```text
DATABASE_URL          = ${{Postgres.DATABASE_URL}}
PAYLOAD_SECRET        = ${{secret(64)}}
S3_BUCKET             = ${{Bucket.BUCKET}}
S3_ENDPOINT           = ${{Bucket.ENDPOINT}}
S3_REGION             = ${{Bucket.REGION}}
S3_ACCESS_KEY_ID      = ${{Bucket.ACCESS_KEY_ID}}
S3_SECRET_ACCESS_KEY  = ${{Bucket.SECRET_ACCESS_KEY}}
```

`${{Postgres.DATABASE_URL}}` is Railway's private-network connection string.
Do not use `DATABASE_PUBLIC_URL`: it routes through the TCP proxy, which is
slower and billed as egress.

`${{secret(64)}}` is evaluated once, when someone deploys the template.

Bucket variable names are the ones Railway documents at
<https://docs.railway.com/storage-buckets>. The endpoint they resolve to is
`https://t3.storageapi.dev`, not the `https://storage.railway.app` those docs
show, which is another reason to reference rather than hardcode. Set them by hand rather than using the
"automatically provision variables" preset, which names them for the AWS SDK
rather than for this application.

Do not set `S3_FORCE_PATH_STYLE`. Railway buckets are virtual-hosted style. Buckets
created before Railway's switch to that style still need `true`, and the bucket's
Credentials tab says which applies.

## Payload CMS service settings

| Setting             | Value                                         |
| ------------------- | --------------------------------------------- |
| Healthcheck path    | `/api/health`                                 |
| Healthcheck timeout | 300                                           |
| Restart policy      | On failure, max 5 retries                     |
| Start command       | leave empty, the image entrypoint handles it  |
| Pre-deploy command  | leave empty, migrations run in the entrypoint |
| Public networking   | enabled, HTTP, port 3000                      |

These must be set in the composer by hand. Railway's Config as Code
(`railway.json`) is deprecated and is **not read at all for services created from
now on**, so a healthcheck committed to the repo would silently never apply. The
repo now describes the project in `.railway/railway.ts` instead, which the Railway
CLI evaluates; the template composer does not read that either.

Migrations run from the container entrypoint rather than a pre-deploy command for
the same reason: the entrypoint is part of the image, so it works however the
service was created. A failed migration exits before the server starts, the
healthcheck never passes, and Railway keeps the previous version live.

## Before publishing

Deploy the template into a fresh, empty project and check all of it. A project
you already deployed from hides most of the failures that only happen cold.

- [ ] All three services reach Online
- [ ] Build succeeds without a reachable database (Railway builds have no private networking)
- [ ] The deploy log shows the migration running once, and succeeding
- [ ] `/api/health` returns 200
- [ ] `/admin` loads and offers to create the first user
- [ ] The first admin account can be created and can log in
- [ ] An image uploads and its thumbnail renders in the admin panel
- [ ] The uploaded image still loads after restarting the Payload service
- [ ] Content still exists after restarting the Postgres service
- [ ] A redeploy with no schema change starts cleanly and skips migrations
- [ ] Adding a custom domain does not break the admin panel
- [ ] Upgrading Payload and deploying the resulting migration works

## Marketplace copy

Title:

```text
Payload CMS 3 - Production Ready
```

Short description:

```text
Production-ready Payload CMS with PostgreSQL and persistent Railway S3 storage. Zero-config deployment, migrations, health checks and automatic environment configuration included.
```

Long description:

```text
Deploy Payload CMS 3 on Railway with a production-ready PostgreSQL database and persistent Railway Storage Bucket.

Unlike basic Payload starters, this template includes production database migrations, persistent S3 media storage, automatic secret and URL configuration, health checks and a production Docker build.

After deployment, simply open /admin and create your first admin account.

Included:
- Payload CMS 3
- PostgreSQL
- Railway Storage Bucket
- Persistent media uploads
- Production migrations
- Health checks
- Automatic environment configuration
- Minimal Users + Media starter schema
```
