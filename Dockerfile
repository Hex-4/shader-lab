ARG NODE_VERSION=23-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /usr/src/app
RUN curl https://bun.sh/install | bash -s
ENV PATH="${PATH}:/root/.bun/bin"

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
WORKDIR /temp/dev
RUN bun install

# Build stage
FROM base AS prerelease
WORKDIR /usr/src/app

COPY . .
COPY --from=install /temp/dev/node_modules node_modules

# Build the app using Node (Bun has memory issues with large builds)
RUN npx nuxt build

# Production stage
FROM node:${NODE_VERSION} AS release
WORKDIR /usr/src/app

COPY --from=prerelease /usr/src/app/.output .output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
