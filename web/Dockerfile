FROM node:20-alpine AS build
WORKDIR /app
ARG API_URL=http://api:4000
ENV API_URL=$API_URL
COPY package.json ./
RUN npm install
COPY . .
RUN npx next build
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production API_URL=http://api:4000
COPY --from=build /app ./
EXPOSE 3000
CMD ["npx","next","start","-p","3000"]
