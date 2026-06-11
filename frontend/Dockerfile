# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Dependency installation with npm cache optimization
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources and compile production bundle
COPY . .
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:1.25-alpine

# Copy custom nginx configuration for SPA routing fallback and cache headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled frontend assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
