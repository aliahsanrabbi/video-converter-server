FROM node:20-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Railway / Render provide PORT env
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
