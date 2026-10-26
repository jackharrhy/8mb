FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm test && npm run build

FROM nginx:alpine
LABEL org.opencontainers.image.source="https://github.com/jackharrhy/8mb"
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html/8mb
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/8mb/ || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
