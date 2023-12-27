# Start from the Ubuntu 22.04 base image
FROM ubuntu:22.04

ARG RESTART_TORII
ENV RESTART_TORII=$RESTART_TORII

ARG RESTART_KATANA
ENV RESTART_KATANA=$RESTART_KATANA

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

SHELL ["/bin/bash", "-c"]

# Update and install some common packages
RUN apt-get update && apt-get install -y \
    curl \
    git \
    vim \
    wget \
	jq \
	bc \
    && rm -rf /var/lib/apt/lists/* && \
	curl -L https://install.dojoengine.org | bash && \
	/root/.dojo/bin/dojoup --version 0.4.1

ENV PATH="${PATH}:/root/.dojo/bin"

EXPOSE 5050

EXPOSE 8080

WORKDIR /app

COPY . /app