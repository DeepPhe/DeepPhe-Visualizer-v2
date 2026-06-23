git# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the React application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install only necessary packages
RUN apk add --no-cache tini

# Copy built files from build stage
COPY --from=build /app/build ./build

# Create optimized package.json for production
RUN echo '{ \
  "name": "deepphe-visualizer-v2", \
  "version": "0.1.0", \
  "dependencies": { \
    "express": "^5.1.0", \
    "compression": "^1.7.4" \
  } \
}' > package.json

# Create optimized server.js
RUN echo 'const express = require("express"); \
const compression = require("compression"); \
const path = require("path"); \
const app = express(); \
const port = process.env.PORT || 3000; \
app.use(compression()); \
app.use((req, res, next) => { \
  res.setHeader("X-Content-Type-Options", "nosniff"); \
  res.setHeader("X-Frame-Options", "DENY"); \
  res.setHeader("X-XSS-Protection", "1; mode=block"); \
  next(); \
}); \
app.use(express.static(path.join(__dirname, "build"), { \
  maxAge: "1y", \
  etag: true, \
  setHeaders: (res, filePath) => { \
    if (filePath.endsWith(".html")) { \
      res.setHeader("Cache-Control", "no-cache"); \
    } \
  } \
})); \
app.use((req, res) => { \
  res.sendFile(path.join(__dirname, "build", "index.html")); \
}); \
const server = app.listen(port, () => { \
  console.log(`DeepPhe Visualizer v2 running on port ${port}`); \
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`); \
}); \
process.on("SIGTERM", () => { \
  console.log("SIGTERM signal received: closing HTTP server"); \
  server.close(() => { \
    console.log("HTTP server closed"); \
    process.exit(0); \
  }); \
});' > server.js

# Install production dependencies
RUN npm install --only=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the server
CMD ["node", "server.js"]
