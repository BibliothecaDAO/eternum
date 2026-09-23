FROM rust:1.89-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY src src
RUN cargo build --release --locked --bin realms-gateway

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/realms-gateway /usr/local/bin/realms-gateway
USER 10001
ENTRYPOINT ["tini", "--", "realms-gateway"]
