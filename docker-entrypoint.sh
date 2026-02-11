#!/bin/sh
set -e

if [ "${PRISMA_MIGRATE_ON_START:-1}" = "1" ]; then
  echo "Running Prisma db push..."
  ./node_modules/.bin/prisma db push --skip-generate
fi

exec "$@"
