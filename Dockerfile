FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# CI image: all dependencies plus the full source, used to lint, format-check and test
FROM base AS ci
RUN npm ci
COPY . .
CMD ["npm", "run", "check"]

# Production image: runtime dependencies and app code only
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
