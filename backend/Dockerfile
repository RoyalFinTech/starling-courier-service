FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY migrations ./migrations
COPY public ./public
EXPOSE 4000
CMD ["sh", "-c", "npm run migrate && npm start"]
