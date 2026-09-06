import config from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

const BOOT_TIMEOUT_MS = 15000
const QUERY_TIMEOUT_MS = 5000

type PoolClient = {
  query: (text: string) => Promise<unknown>
  release: () => void
}

type Pool = {
  connect: () => Promise<PoolClient>
}

/**
 * getPayload caches the pending init promise, so a boot that never settles would
 * hang every later healthcheck too. Bounding it turns that into a 503 the platform
 * can act on.
 */
const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Railway's healthcheck target. Returns 200 only once Payload has booted and the
 * database answers, so a deploy is never routed traffic before it can serve it.
 */
export const GET = async () => {
  try {
    const payload = await withTimeout(getPayload({ config }), BOOT_TIMEOUT_MS, 'payload boot')
    const pool = (payload.db as unknown as { pool?: Pool }).pool

    if (typeof pool?.connect !== 'function') {
      // The adapter's internal pool is not part of Payload's public API, so say so
      // clearly rather than reporting a database outage that is not happening.
      throw new Error('postgres pool not found on the database adapter')
    }

    // The client is checked out explicitly, and the timeout is enforced by Postgres,
    // so a stalled query cannot leave a connection checked out of the pool.
    const client = await pool.connect()

    try {
      await client.query(`SET statement_timeout = ${QUERY_TIMEOUT_MS}`)
      await client.query('SELECT 1')
    } finally {
      await client.query('SET statement_timeout = DEFAULT').catch(() => {})
      client.release()
    }

    return Response.json({ status: 'ok' })
  } catch (error) {
    console.error('[health]', error)

    // Deliberately opaque: the reason belongs in the deploy logs, not the response.
    return Response.json({ status: 'error' }, { status: 503 })
  }
}
