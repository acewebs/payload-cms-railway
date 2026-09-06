#!/bin/sh
set -e

# Migrations run before the server starts, so a failed migration fails the deploy
# instead of putting an application in front of a schema it does not match.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node scripts/migrate.mjs
fi

exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
