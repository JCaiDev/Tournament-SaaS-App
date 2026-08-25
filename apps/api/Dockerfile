# 1. Base image (runtime)
FROM node:20-alpine

# 2. Set working directory inside container
WORKDIR /app

# 3. Copy dependency files first (for caching)
COPY package.json package-lock.json ./

# 4. Install dependencies
RUN npm ci

# 5. Copy the rest of the source code
COPY . .

# 6. Generate Prisma client
RUN npx prisma generate

# 7. Build TypeScript
RUN npm run build

# 8. Expose the port your app runs on
EXPOSE 3001

# 9. Start the app
CMD ["node", "dist/server.js"]
