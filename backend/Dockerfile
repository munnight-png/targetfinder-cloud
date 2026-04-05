FROM node:20-slim

# Install build tools needed for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

EXPOSE 3001

CMD ["npx", "ts-node", "src/server.ts"]
