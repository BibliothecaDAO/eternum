# Katana v1.8.0-rc.9 for the Realms appchain spike (M0).
#
# Two deviations from the stock image, both inherited from the cagecalls
# production stack (see docs/plans/appchain-phase-1.md, "References"):
#
# 1. vrf-server built from source at rev 65d6ff0. The image's asdf-installed
#    vrf 0.3.1 still expects externally-tagged outside-execution JSON
#    ({"V2": ...}); katana rc.9 serializes untagged, so every request_random
#    through the VRF middleware dies with:
#      unknown variant `caller`, expected `V2` or `V3`
#    Katana's own sidecar-versions.toml pins the fixed rev, but the Docker
#    image ignores that file. No released vrf-server contains the fix.
#    Consumed via --vrf.bin, immune to PATH ordering against the stale binary.
#
# 2. paymaster-service v0.2.4 baked in (image ships 0.2.3, which rejects a hex
#    chain id — e.g. WP_REALMS_DEV as a felt — and kills the node). Passed via
#    --paymaster.bin to keep katana in sidecar mode, which is what deploys the
#    on-chain AVNU forwarder; --paymaster.url external mode skips that
#    bootstrap and breaks session-key relaying.

FROM rust:1-bookworm AS vrf-build
# --locked pins to server/Cargo.lock; without it cargo resolves fresh
# transitive versions (starknet-rs/account_sdk drift) and the build fails.
RUN cargo install --git https://github.com/cartridge-gg/vrf.git \
    --rev 65d6ff054ee97e29676780bec5fe5b93b822b509 \
    --locked vrf-server --root /opt/vrf

FROM ghcr.io/dojoengine/katana:v1.8.0-rc.9

COPY --from=vrf-build /opt/vrf/bin/vrf-server /usr/local/bin/vrf-server-untagged

ARG PAYMASTER_VERSION=v0.2.4
ARG PAYMASTER_SHA256=73f86d5c4c8f81aff1ff6e0161833ee188089d677ebc561b93bd9ea3046d134c
RUN curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors \
      -o /tmp/paymaster-service.tar.gz \
      "https://github.com/cartridge-gg/paymaster/releases/download/${PAYMASTER_VERSION}/paymaster-service-${PAYMASTER_VERSION}-x86_64-unknown-linux-gnu.tar.gz" \
 && echo "${PAYMASTER_SHA256}  /tmp/paymaster-service.tar.gz" | sha256sum -c - \
 && tar xzf /tmp/paymaster-service.tar.gz -C /usr/local/bin paymaster-service \
 && chmod +x /usr/local/bin/paymaster-service \
 && rm /tmp/paymaster-service.tar.gz
