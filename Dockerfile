# Baiguullagiin serwert bairshuulah (3.1.2, Zurag 3.2)
# Buteeh:   docker compose build
# Ajilluulah: docker compose up -d

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN apk add --no-cache openssl && addgroup -S app && adduser -S app -G app
# Next.js standalone garalt (next.config.ts: output "standalone").
# --chown: eh failuud 600 erhtei baisan ch app hereglegch unshij chadna
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Ehlehdee migrats hiihed heregtei
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
# Prisma CLI-g buh hamaarliinh ni hamt tusdaa hawtsand suulgana (standalone garaltad baidaggui).
# Huwilbariig tusliin lock failtai ijil bailgana.
COPY --from=build /app/node_modules/prisma/package.json /tmp/prisma-version.json
RUN npm install --prefix /opt/prisma --no-audit --no-fund "prisma@$(node -p "require('/tmp/prisma-version.json').version")" \
 && rm /tmp/prisma-version.json && chown -R app:app /opt/prisma
USER app
EXPOSE 3000
# Ehlehdee ugugdliin sangiin shiljiltiig (migration) hiigeed sistemiig asaana
CMD ["sh", "-c", "/opt/prisma/node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && node server.js"]
