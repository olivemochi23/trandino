# syntax=docker/dockerfile:1

FROM node:20 AS base

# Create app directory
WORKDIR /app

# Create a non-root user and group
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
# Use .dockerignore to exclude unnecessary files
COPY . .

# Change ownership to non-root user
RUN chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

EXPOSE 8080

CMD ["node", "src/index.js"] 