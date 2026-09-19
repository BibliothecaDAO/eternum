ARG BUN_IMAGE
FROM ${BUN_IMAGE}
WORKDIR /app
COPY --chown=bun:bun herald.js ./herald.js
USER bun
ENTRYPOINT ["bun", "/app/herald.js"]
