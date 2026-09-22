FROM node:20-slim

WORKDIR /app

# Root manifests: the root package.json declares the workspaces, and the
# root package-lock.json is the single source of truth for versions.
COPY package.json package-lock.json ./

# Each workspace's manifest, but not its source. npm needs every workspace
# manifest to validate the lockfile, and copying only these keeps the
# install layer cached when application code changes.
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Install only the API's dependencies plus the root's, so Angular's
# dependencies never enter this image.
RUN npm ci --workspace=@my-app/api --include-workspace-root

# The API source. This is the layer that changes on most builds.
COPY apps/api apps/api

# Runs "prisma generate && tsc" with apps/api as the working directory.
# prisma.config.ts resolves DIRECT_URL eagerly, but "prisma generate" never
# connects to a database, so a placeholder satisfies it. It is scoped to this
# one command and is not stored in the image.
RUN DIRECT_URL="postgresql://placeholder" npm run build --workspace=@my-app/api

EXPOSE 3001

CMD ["node", "apps/api/dist/server.js"]
