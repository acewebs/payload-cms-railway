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

## Variable descriptions

Railway will not publish a template until every required variable has one. The
Postgres wording below is Railway's own, copied from their published `postgres`
template so ours reads consistently with it.

Payload CMS service:

```text
DATABASE_URL          Connection to the Postgres service in this project. Set for you.
PAYLOAD_SECRET        Signs authentication tokens and session cookies. Generated on
                      deploy. Changing it signs every user out.
S3_BUCKET             Bucket that uploaded media is written to. Set from the Bucket in
                      this project, so uploads survive redeploys and restarts.
S3_ENDPOINT           S3 API endpoint for the bucket. Set from the Bucket in this
                      project rather than hardcoded, because it can differ per bucket.
S3_REGION             Region the bucket was created in. Set from the Bucket in this
                      project. A bucket cannot be moved to another region later.
S3_ACCESS_KEY_ID      Access key ID for the bucket. Set from the Bucket in this project.
S3_SECRET_ACCESS_KEY  Secret access key for the bucket. Set from the Bucket in this
                      project.
```

Postgres service:

```text
DATABASE_URL                         URL to connect to Postgres database.
PGDATA                               Location where the database will be initialized
PGDATABASE                           Required variable for the data panel.
PGHOST                               Railway Private Domain Name.
PGPASSWORD                           Required variable for Data panel
PGPORT                               Port to connect to Postgres.
PGUSER                               Required variable for Data panel
POSTGRES_DB                          Default database created when image is started.
POSTGRES_PASSWORD                    Password to connect to DB
POSTGRES_USER                        User to connect to Postgres DB
RAILWAY_DEPLOYMENT_DRAINING_SECONDS  Allow Postgres to cleanly shut down
SSL_CERT_DAYS                        SSL certificate expiry in days.
```

## Listing category

File it under **CMS**, not Starters. Payload is a headless CMS and this ships all
of it: admin panel, REST and GraphQL, auth, media, access control. The website
template that other listings build on is a demo site on top of the CMS, not what
makes it one. CMS is also where anyone shopping for Payload looks, and filing
something called Production Ready under Starters invites a reader to discount it.

## Marketplace copy

Name, 30 characters:

```text
Payload CMS 3 Production Ready
```

Short description, 69 of the 72 characters available:

```text
Backend foundation, zero config: PostgreSQL, bucket media, migrations
```

The two are written to divide the work. The name wins the search and stakes the
claim; the description never repeats it, and spends its budget on what the name
cannot say. "Backend foundation" is deliberate: the Payload template with the
most deploys in the marketplace is a website builder, and this is the opposite of
that. Do not swap it for "minimal", which reads as unfinished next to
"Production Ready", or for "starter", which is what this template positions
against.

The long listing body is in [marketplace-listing.md](marketplace-listing.md),
following Railway's required section structure.
