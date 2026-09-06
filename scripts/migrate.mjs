/**
 * Runs `payload migrate` exactly once per deploy, however many replicas start.
 *
 * Two things the bare CLI does not do: wait for Postgres to accept connections
 * (on a cold Railway deploy the database can still be booting), and serialise
 * concurrent replicas behind a Postgres advisory lock so they cannot apply the
 * same migration twice.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

import pg from 'pg'

const ADVISORY_LOCK_KEY = 8264193025771 // arbitrary, must be stable across deploys
const CONNECT_ATTEMPTS = 30
const CONNECT_DELAY_MS = 2000
const LOCK_TIMEOUT_MS = 600000
const KEEPALIVE_MS = 30000

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error(
    '[migrate] DATABASE_URL is not set. On Railway, add a Postgres service and set' +
      ' DATABASE_URL to ${{Postgres.DATABASE_URL}} on this service.',
  )
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const connect = async () => {
  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
    // The advisory lock lives on this connection for as long as the migration runs,
    // so it must not be dropped by an idle timeout somewhere in the path.
    // connectionTimeoutMillis is 0 by default in node-postgres, which would let a
    // black-holed connection hang forever and never reach the retry below.
    const client = new pg.Client({
      connectionString,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
    })

    try {
      await client.connect()
      return client
    } catch (error) {
      await client.end().catch(() => {})

      if (attempt === CONNECT_ATTEMPTS) {
        throw error
      }

      console.log(
        `[migrate] database not reachable yet (attempt ${attempt}/${CONNECT_ATTEMPTS}): ${error.message}`,
      )
      await sleep(CONNECT_DELAY_MS)
    }
  }
}

const runPayloadMigrate = () =>
  new Promise((resolve, reject) => {
    const bin = path.join(process.cwd(), 'node_modules', '.bin', 'payload')
    const child = spawn(bin, ['migrate'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --no-deprecation`.trim(),
      },
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
      } else {
        reject(
          new Error(`payload migrate exited with ${signal ? `signal ${signal}` : `code ${code}`}`),
        )
      }
    })
  })

const client = await connect()
let keepalive

try {
  await client.query(`SET lock_timeout = ${LOCK_TIMEOUT_MS}`)
  await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY])

  keepalive = setInterval(() => {
    client.query('SELECT 1').catch((error) => {
      console.error(`[migrate] lock connection is unhealthy: ${error.message}`)
    })
  }, KEEPALIVE_MS)
  keepalive.unref()

  console.log('[migrate] running payload migrate')
  await runPayloadMigrate()
  console.log('[migrate] done')
} catch (error) {
  console.error(`[migrate] failed: ${error.message}`)
  process.exitCode = 1
} finally {
  clearInterval(keepalive)
  await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {})
  await client.end().catch(() => {})
}
