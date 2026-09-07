import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { allowedOrigins, isProduction, resolveS3Settings } from './lib/env'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Null when no bucket is configured, which is how local development runs: the
// plugin is registered either way but switched off, and Payload falls back to
// disk storage. A half-configured bucket throws instead, see resolveS3Settings.
const s3 = resolveS3Settings()

if (!s3 && isProduction) {
  console.warn(
    '[payload] No object storage configured. Uploads will be written to the container ' +
      'filesystem and lost on the next deploy. Set S3_BUCKET, S3_ACCESS_KEY_ID and ' +
      'S3_SECRET_ACCESS_KEY to store them in a bucket.',
  )
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Left relative on purpose: the admin panel then works on the Railway-generated
  // domain and on any custom domain without a redeploy. Set NEXT_PUBLIC_SERVER_URL
  // only if you need Payload to emit absolute URLs.
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',
  cors: allowedOrigins,
  csrf: allowedOrigins,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
      // Bounded so a stalled database surfaces as an error rather than as requests
      // queueing forever on a checkout that never completes.
      connectionTimeoutMillis: 10000,
      max: Number(process.env.DATABASE_POOL_MAX || 10),
    },
    migrationDir: path.resolve(dirname, 'migrations'),
    // Production schema changes go through committed migrations only.
    push: !isProduction,
  }),
  sharp,
  plugins: [
    // Registered unconditionally and switched off when no bucket is configured,
    // rather than registered conditionally. Payload regenerates the import map during
    // `next build`, from whatever environment the build runs in. The Railway image
    // is built without bucket credentials, so a conditional plugin is absent at
    // build time and its client component never reaches the import map, then the
    // admin panel renders nothing at runtime where the bucket does exist.
    // alwaysInsertFields keeps the collection schema identical either way, so
    // migrations do not depend on the environment that generated them.
    s3Storage({
      collections: {
        media: true,
      },
      alwaysInsertFields: true,
      bucket: s3?.bucket ?? '',
      config: {
        credentials: {
          accessKeyId: s3?.accessKeyId ?? '',
          secretAccessKey: s3?.secretAccessKey ?? '',
        },
        endpoint: s3?.endpoint,
        forcePathStyle: s3?.forcePathStyle ?? false,
        region: s3?.region ?? 'auto',
      },
      enabled: Boolean(s3),
    }),
  ],
})
