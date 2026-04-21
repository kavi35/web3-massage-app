FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci

# Copy the rest of the project.
COPY . .

EXPOSE 8000

CMD ["npm", "start"]
