# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=22.7.0
FROM node:${NODE_VERSION}-alpine AS base 

# Dependencies image
FROM base AS dependencies

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY package*.json ./
# Download dependencies as a separate step to take advantage of Docker's caching.
RUN npm ci --include=dev
# Copy the rest of the source files into the image.
COPY . .

# Builder image
FROM base AS builder

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY ../package*.json ./
# Copy the dependencies from the dependencies image.
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
# Copy the rest of the source files into the image.
COPY . .
# Build the server please
RUN npm run build:server

#Production image
FROM base AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY ../package*.json ./
# Install ONLY production dependencies
RUN npm ci --omit=dev
# Copy the built server from the builder image.
COPY --from=builder /usr/src/app/dist ./dist

ARG PORT=80
ENV PORT=${PORT}
# Expose the port that the application listens on.
EXPOSE ${PORT}

# Run the application.
CMD node dist/server.js
