FROM node:20

# Install build tools needed for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies fresh (Linux native build)
COPY package*.json ./
RUN npm install --build-from-source

# Copy source files (node_modules excluded via .dockerignore)
COPY . .

EXPOSE 3001

CMD ["npx", "ts-node", "src/server.ts"]
