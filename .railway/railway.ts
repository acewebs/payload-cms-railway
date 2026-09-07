import { bucket, defineRailway, github, postgres, preserve, project, service } from 'railway/iac'

/**
 * The application and its database, with their variables wired between them.
 * The bucket is provisioned separately by scripts/railway-bucket.sh; see the
 * comment on the S3_ variables below for why.
 *
 * This replaces the deprecated railway.json. Config as Code only ever described
 * one service's deploy settings, and Railway no longer reads it for services
 * created from now on, so the healthcheck and restart policy in it were about to
 * stop being applied.
 *
 * Evaluated by the Railway CLI only, so it does not interfere with deploying
 * through the marketplace template or the dashboard:
 *
 *   railway config plan     preview
 *   railway config apply    create or update the project
 *
 * Applying this owns the environment: resources absent from this file are
 * deleted. Do not point it at a project that has anything else in it.
 */
// Must match the region passed to scripts/railway-bucket.sh. Change both together,
// before first deploy: sjc (US West), iad (US East), ams (EU West), sin (Asia Pacific).
const BUCKET_REGION = 'ams'

export default defineRailway((ctx) => {
  const db = postgres('Postgres')

  // Declared so that `railway config apply` adopts the bucket instead of offering
  // to delete it, but NOT created here: a bucket() declaration reports success and
  // creates nothing (Railway CLI 5.49.2), which is why scripts/railway-bucket.sh
  // exists. That script names its bucket 'Bucket' and takes the same region, and
  // the two must agree: a region cannot be changed after the bucket is created.
  const media = bucket('Bucket', { region: BUCKET_REGION })

  const payload = service('Payload CMS', {
    source: github('acewebs/payload-cms-railway', { branch: 'main' }),
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'Dockerfile',
    },
    healthcheck: '/api/health',
    // Generous: the first deploy runs migrations before the server starts.
    healthcheckTimeout: 300,
    deploy: {
      // A failed migration should fail the deploy, not restart forever.
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 5,
    },
    replicas: 1,
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      PAYLOAD_SECRET: ctx.randomString('payload-secret', 48),
      // The bucket is created by scripts/railway-bucket.sh, not here: a bucket()
      // declared in this file reports "applied" and then does not exist, which
      // leaves these resolving to empty strings and sends uploads to disk.
      // preserve() keeps whatever that script set instead of overwriting it.
      S3_BUCKET: preserve(),
      S3_ENDPOINT: preserve(),
      S3_REGION: preserve(),
      S3_ACCESS_KEY_ID: preserve(),
      S3_SECRET_ACCESS_KEY: preserve(),
    },
  })

  return project('payload-cms', {
    resources: [payload, db, media],
  })
})
