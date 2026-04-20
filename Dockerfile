# Stage 1: Build Frontend
FROM node:20 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Final Backend Image
FROM node:20
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package*.json ./
RUN npm install --build-from-source

# Copy backend source
COPY backend/ .

# Copy built frontend from Stage 1 to the 'public' folder inside backend
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 3001
CMD ["npx", "ts-node", "src/server.ts"]
