FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production --no-audit --no-fund || npm install --no-audit --no-fund
COPY src ./src
EXPOSE 5001
CMD ["node","src/index.js"]
