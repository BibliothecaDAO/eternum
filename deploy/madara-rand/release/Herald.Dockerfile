ARG MADARA_IMAGE
FROM ${MADARA_IMAGE}
COPY herald /bin/herald
ENTRYPOINT ["tini", "--", "/bin/herald"]
