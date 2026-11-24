FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
WORKDIR /app
COPY backend ./backend
EXPOSE 8787
CMD ["node", "backend/server.js"]
