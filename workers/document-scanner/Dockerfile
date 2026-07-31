FROM node:22.22.0-alpine
WORKDIR /worker
COPY --chown=node:node index.mjs ./index.mjs
USER node
CMD ["node", "index.mjs"]
