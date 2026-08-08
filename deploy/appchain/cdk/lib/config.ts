// Central knobs for the Realms appchain stacks. Everything here is a plain
// constant on purpose — one environment (dev) for Phase 1, a second block gets
// added when the Phase 2 settling chain exists.

export const CONFIG = {
  /** GitHub repo allowed to assume the OIDC roles. */
  githubRepo: "BibliothecaDAO/eternum",

  /** Delegated public zone (NS record added in the realms.world DNS panel). */
  zoneName: "appchain.realms.world",

  dev: {
    /**
     * TLS + named hosts. false = HTTP-only mode: no cert, no Route53 records,
     * ALB port-routing (:80 katana, :8080 torii) — used until DNS access for
     * realms.world (or a substitute domain) exists. Controller testing in
     * this mode goes through a cloudflared tunnel, like M0.
     */
    tls: false,
    /**
     * Public hostnames fronted by Cloudflare (proxied CNAMEs -> the ALB).
     * Cloudflare terminates TLS with its own certificate, so we need no ACM
     * cert and no Route53 delegation. They must be SINGLE-level subdomains:
     * Cloudflare's Universal SSL covers `*.jcndata.com` but not
     * `*.appchain.jcndata.com`, which would fail TLS.
     * The ALB routes these by Host header on :80.
     */
    publicKatanaHost: "katana.jcndata.com",
    publicToriiHost: "torii.jcndata.com",
    /**
     * Game client bucket. The name MUST equal the hostname: S3 website
     * endpoints route by Host header, so a CNAME only resolves to the right
     * bucket when they match. Cloudflare proxies it and terminates TLS
     * (the S3 website endpoint is HTTP-only, which is why the zone runs in
     * Flexible mode).
     */
    publicClientHost: "play.jcndata.com",
    /** Host names under the delegated zone (used when tls: true). */
    katanaHost: "katana.dev.appchain.realms.world",
    toriiHost: "torii.dev.appchain.realms.world",
    /** Wildcard cert covering the dev hosts. */
    certWildcard: "*.dev.appchain.realms.world",

    /**
     * Bespoke chain id. Never SN_SEPOLIA — the Controller keychain must be
     * able to distinguish this chain (cagecalls lesson; validated in M0).
     */
    chainId: "WP_REALMS_DEV",

    /**
     * Sequencer host. Capped at ONE vCPU until the account's On-Demand quota
     * increase lands (spot is capped at 1 too), so this is the best 1-vCPU
     * box available rather than the m6a.large we actually want:
     * m7a.medium is modern AMD, non-burstable and 4 GiB, vs t2.small's older
     * burstable core and 2 GiB. Block execution is effectively single-core,
     * so per-core performance is what matters most here.
     *
     * Bump to m6a.large (2 vCPU/8 GiB) the moment quota allows — a type change
     * is applied as stop → modify → start, and the chain data lives on a
     * separate RETAIN volume mounted by UUID, so the chain survives it. That
     * is the whole reason katana is on EC2 rather than Fargate.
     */
    katanaInstanceType: "m7a.medium",
    katanaDataGib: 50,

    /** Multi-world indexing needs headroom above the 4 GiB single-world load-test size. */
    toriiCpu: 2048,
    toriiMemoryMib: 8192,

    /** Empty-block heartbeat interval (rc.9's --block-time is broken). */
    heartbeatSeconds: 30,

    /** WAF rate limit per IP per 5 minutes. */
    wafRateLimit: 2000,

    /** Alarm + budget notifications. */
    alertEmail: "jean.christophe.mehr@gmail.com",
  },

  ecr: {
    katanaRepo: "realms-appchain/katana",
    toriiRepo: "realms-appchain/torii",
    /** Tags pushed by scripts/push-images.sh (digest-pinned at deploy time). */
    katanaTag: "rc9-vrf-paymaster-v1",
    toriiTag: "1.8.16-mw-dynamic-v4",
  },
} as const;
