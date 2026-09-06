export const isProduction = process.env.NODE_ENV === 'production'

const railwayURL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : undefined

/**
 * Origins allowed to talk to the API with credentials. The admin panel is served
 * from the same origin so it never needs an entry here; these exist for external
 * clients and for Railway's generated domain.
 */
export const allowedOrigins = Array.from(
  new Set(
    [process.env.NEXT_PUBLIC_SERVER_URL, railwayURL, !isProduction && 'http://localhost:3000']
      .filter(Boolean)
      .map((origin) => (origin as string).replace(/\/$/, '')),
  ),
)

export type S3Settings = {
  accessKeyId: string
  bucket: string
  endpoint?: string
  forcePathStyle: boolean
  region: string
  secretAccessKey: string
}

const S3_VARS = [
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_FORCE_PATH_STYLE',
] as const

const REQUIRED_S3_VARS = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const

/**
 * Returns the bucket settings, or null when no bucket is configured at all and
 * uploads should go to disk instead.
 *
 * A half-configured bucket throws rather than falling back, because the silent
 * fallback is a data-loss trap: uploads would appear to work and then vanish
 * with the container filesystem on the next deploy.
 */
export const resolveS3Settings = (): S3Settings | null => {
  const present = S3_VARS.filter((name) => process.env[name])

  if (present.length === 0) {
    return null
  }

  const missing = REQUIRED_S3_VARS.filter((name) => !process.env[name])

  if (missing.length > 0) {
    throw new Error(
      `Object storage is partially configured: ${present.join(', ')} set, but ${missing.join(', ')} missing. ` +
        'Set all of S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or none of the S3_ variables to store uploads on disk.',
    )
  }

  return {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    bucket: process.env.S3_BUCKET!,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    region: process.env.S3_REGION || 'auto',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  }
}
