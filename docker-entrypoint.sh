#!/bin/sh
set -e

if [ "${PRISMA_MIGRATE_ON_START:-1}" = "1" ]; then
  echo "Running Prisma db push..."
  node ./node_modules/prisma/build/index.js db push --schema ./prisma/schema.prisma --skip-generate
fi

exec "$@"
