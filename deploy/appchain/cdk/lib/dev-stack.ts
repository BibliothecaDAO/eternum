import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { CONFIG } from "./config";

export interface DevStackProps extends cdk.StackProps {
  katanaRepo: ecr.IRepository;
}

/**
 * The Phase 1 dev appchain, prod-pattern: ONE EC2 box runs katana + both
 * toriis in docker plus nginx doing Host-header routing on :80. Cloudflare
 * (Flexible mode) fronts the public hostnames and points at the box's
 * Elastic IP; scripts hit :8081/:8082 directly. Chain data and torii DBs
 * live on an instance-attached RETAIN volume, so resizes, replacements and
 * config rolls keep both the chain and the indexes.
 */
/** Stock upstream torii, digest-pinned (v1.8.16) — no fork patches. */
const TORII_IMAGE =
  "ghcr.io/dojoengine/torii@sha256:4f6633c1f8fddbc68d647e14f424c91f083c20d14a5dd4661eb0ab77841899ac";

export class DevStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DevStackProps) {
    super(scope, id, props);
    const cfg = CONFIG.dev;

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC },
      ],
    });

    // --- Katana box: EC2 singleton ---------------------------------------
    const katanaSubnet = vpc.publicSubnets[0];

    const katanaSg = new ec2.SecurityGroup(this, "KatanaSg", {
      vpc,
      description: "katana sequencer",
      allowAllOutbound: true,
    });
    // Prod-pattern colocation: the box serves Cloudflare directly on :80
    // (nginx host-routing, the surface the ALB used to provide) and scripts
    // on the torii ports.
    katanaSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "nginx: cloudflare + cli + ACME");
    // Torii hostnames are grey-clouded (DNS-only): browsers hit nginx :443
    // directly, escaping Cloudflare's ~100s idle cutoff that killed the
    // sparse SubscribeEventMessages grpc-web stream.
    katanaSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "nginx: direct TLS (torii hosts)");
    katanaSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8081), "torii-s2 direct (scripts)");
    katanaSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8082), "torii-eternum direct (scripts)");

    const katanaLogs = new logs.LogGroup(this, "KatanaLogs", {
      logGroupName: "/realms-appchain/dev/katana",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const katanaRole = new iam.Role(this, "KatanaRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        // SSM Session Manager is the only shell access — no SSH, no key pairs
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });
    props.katanaRepo.grantPull(katanaRole);
    katanaLogs.grantWrite(katanaRole);
    // Colocated toriis: config fetch from SSM + awslogs into the torii groups.
    katanaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/realms-appchain/dev/torii-*-config`,
        ],
      }),
    );
    katanaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/realms-appchain/dev/torii-*`,
          `arn:aws:logs:${this.region}:${this.account}:log-group:/realms-appchain/dev/torii-*:*`,
        ],
      }),
    );

    // Chain data lives on this volume, not the instance — instance
    // replacement or resize keeps the chain. RETAIN so a stack delete can't
    // take the chain with it.
    const dataVolume = new ec2.Volume(this, "KatanaData", {
      availabilityZone: katanaSubnet.availabilityZone,
      size: cdk.Size.gibibytes(cfg.katanaDataGib),
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      encrypted: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const image = `${props.katanaRepo.repositoryUri}:${CONFIG.ecr.katanaTag}`;
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "set -euxo pipefail",
      "dnf install -y docker",
      "systemctl enable --now docker",
      // Wait for the data volume (CFN attaches it in parallel with boot),
      // format on first use only, mount by UUID. Root-disk detection must
      // work on both xen (t2: xvda/xvdf) and nitro (m6a: nvme0n1/nvme1n1).
      "ROOT_DISK=$(lsblk -no PKNAME $(findmnt -no SOURCE /) | head -1)",
      'for i in $(seq 1 60); do DEV=$(lsblk -dnpo NAME | grep -v "/dev/$ROOT_DISK$" | head -1); [ -n "$DEV" ] && break; sleep 5; done',
      '[ -n "$DEV" ] || { echo "data volume never appeared"; exit 1; }',
      'blkid "$DEV" || mkfs.ext4 "$DEV"',
      "mkdir -p /data",
      'UUID=$(blkid -s UUID -o value "$DEV")',
      'grep -q "$UUID" /etc/fstab || echo "UUID=$UUID /data ext4 defaults,nofail 0 2" >> /etc/fstab',
      "mount -a",
      // Subdir because katana rejects a data dir with lost+found in it.
      "mkdir -p /data/katana-db-v3",
      // Config file: [dev]/[server]/[starknet]/[metrics] only. chain-id,
      // cartridge, paymaster and vrf MUST stay CLI flags — rc.9 silently
      // ignores chain_id in the file and panics on [cartridge]/[paymaster].
      "mkdir -p /etc/katana",
      "cat > /etc/katana/katana.toml <<'KATANA_TOML'",
      "[dev]",
      "dev = true",
      "no_fee = true",
      'seed = "0"',
      "total_accounts = 20",
      "",
      "[server]",
      'http_addr = "0.0.0.0"',
      "http_port = 5050",
      'http_cors_origins = "*"',
      "timeout = 300",
      "",
      "[starknet]",
      "env.invoke_max_steps = 25000000",
      "",
      "[metrics]",
      "metrics = true",
      'metrics_addr = "0.0.0.0"',
      "metrics_port = 9100",
      "KATANA_TOML",
      `aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${this.account}.dkr.ecr.${this.region}.amazonaws.com`,
      "docker rm -f katana heartbeat || true",
      [
        "docker run -d --name katana --restart=always",
        "-p 5050:5050 -p 9100:9100",
        "-v /etc/katana/katana.toml:/config/katana.toml:ro",
        "-v /data:/data",
        `--log-driver=awslogs --log-opt awslogs-group=${katanaLogs.logGroupName} --log-opt awslogs-stream=katana --log-opt awslogs-region=${this.region}`,
        "-e RUST_LOG=info",
        image,
        `/bin/sh -c 'exec katana --config /config/katana.toml --data-dir /data/katana-db-v3 --chain-id ${cfg.chainId} --cartridge.controllers --paymaster --cartridge.paymaster --paymaster.bin /usr/local/bin/paymaster-service --vrf --vrf.bin /usr/local/bin/vrf-server-untagged'`,
      ].join(" "),
      // Heartbeat: mine an empty block while idle (--block-time is broken on
      // rc.9). Host network so a katana container restart can't strand it.
      [
        "docker run -d --name heartbeat --restart=always --network host",
        `--log-driver=awslogs --log-opt awslogs-group=${katanaLogs.logGroupName} --log-opt awslogs-stream=heartbeat --log-opt awslogs-region=${this.region}`,
        image,
        `/bin/sh -c 'while true; do curl -sf -m 10 -o /dev/null -X POST -H "content-type: application/json" -d "{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"dev_generateBlock\\",\\"params\\":[]}" http://127.0.0.1:5050 || true; sleep ${cfg.heartbeatSeconds}; done'`,
      ].join(" "),
      // --- Colocated toriis (prod pattern: everything on the box) ---------
      // Config source of truth stays in SSM; the refresh script fetches it
      // and forces rpc to the local katana (the SSM copy carries the external
      // RPC URL, which the box must not loop through). DBs live on the
      // persistent data volume, so config rolls and instance replacements no
      // longer reindex from block 0 — bump the db-vN dir to force a wipe.
      "mkdir -p /etc/torii /data/torii-s2 /data/torii-eternum",
      "cat > /usr/local/bin/torii-refresh <<'TORII_REFRESH'",
      "#!/bin/bash",
      "# torii-refresh <s2|eternum> — re-fetch SSM config and restart the container.",
      "set -euo pipefail",
      'NAME="$1"',
      'PARAM="/realms-appchain/dev/torii-${NAME}-config"',
      `aws ssm get-parameter --region ${this.region} --name "$PARAM" --query Parameter.Value --output text \\`,
      "  | sed 's|^rpc = .*|rpc = \"http://katana:5050\"|' > \"/etc/torii/torii-${NAME}.toml\"",
      'docker restart "torii-${NAME}" 2>/dev/null || true',
      "TORII_REFRESH",
      "chmod +x /usr/local/bin/torii-refresh",
      "docker network create appchain || true",
      "docker network connect appchain katana || true",
      "/usr/local/bin/torii-refresh s2",
      "/usr/local/bin/torii-refresh eternum",
      "docker rm -f torii-s2 torii-eternum || true",
      [
        "docker run -d --name torii-s2 --restart=always --network appchain -p 8081:8080",
        "-v /etc/torii/torii-s2.toml:/config/torii.toml:ro -v /data/torii-s2:/data",
        `--log-driver=awslogs --log-opt awslogs-group=/realms-appchain/dev/torii-s2 --log-opt awslogs-stream=torii-s2-box --log-opt awslogs-region=${this.region}`,
        "--entrypoint /bin/sh",
        TORII_IMAGE,
        `-c 'exec torii --config /config/torii.toml --http.addr 0.0.0.0 --http.port 8080 --http.cors_origins "*"'`,
      ].join(" "),
      [
        "docker run -d --name torii-eternum --restart=always --network appchain -p 8082:8080",
        "-v /etc/torii/torii-eternum.toml:/config/torii.toml:ro -v /data/torii-eternum:/data",
        `--log-driver=awslogs --log-opt awslogs-group=/realms-appchain/dev/torii-eternum --log-opt awslogs-stream=torii-eternum-box --log-opt awslogs-region=${this.region}`,
        "--entrypoint /bin/sh",
        TORII_IMAGE,
        `-c 'exec torii --config /config/torii.toml --http.addr 0.0.0.0 --http.port 8080 --http.cors_origins "*"'`,
      ].join(" "),
      // --- nginx: the ALB's :80 Host-header routing, on the box -----------
      // Cloudflare (Flexible mode) proxies the public hostnames to :80.
      // Streaming-friendly: HTTP/1.1, no buffering, 3600 s read timeout
      // (matches the ALB idle timeout the grpc-web streams rely on).
      "dnf install -y nginx certbot",
      // Certs live on the RETAIN /data volume: instance replacement comes up
      // with the existing certs; certbot below is a no-op until renewal.
      "mkdir -p /var/www/certbot /data/letsencrypt",
      "rm -rf /etc/letsencrypt && ln -s /data/letsencrypt /etc/letsencrypt",
      "cat > /etc/nginx/nginx.conf <<'NGINX_CONF'",
      "user nginx;",
      "worker_processes auto;",
      "events { worker_connections 4096; }",
      "http {",
      "  access_log off;",
      // The client's StoryEvent SQL SELECT travels as a ~9 KB GET query string;
      // the 8k default request-line buffer 414s it before torii ever sees it.
      "  large_client_header_buffers 4 64k;",
      "  map $http_upgrade $connection_upgrade { default upgrade; '' close; }",
      "  server {",
      `    listen 80; server_name ${cfg.publicToriiHost};`,
      "    location /.well-known/acme-challenge/ { root /var/www/certbot; }",
      "    location / { proxy_pass http://127.0.0.1:8081; include /etc/nginx/proxy-common.conf; }",
      "  }",
      "  server {",
      `    listen 80; server_name ${cfg.publicToriiEternumHost};`,
      "    location /.well-known/acme-challenge/ { root /var/www/certbot; }",
      "    location / { proxy_pass http://127.0.0.1:8082; include /etc/nginx/proxy-common.conf; }",
      "  }",
      "  server {",
      `    listen 80 default_server; server_name ${cfg.publicKatanaHost} _;`,
      "    location / { proxy_pass http://127.0.0.1:5050; include /etc/nginx/proxy-common.conf; }",
      "  }",
      "}",
      "NGINX_CONF",
      "cat > /etc/nginx/proxy-common.conf <<'NGINX_PROXY'",
      "proxy_http_version 1.1;",
      "proxy_buffering off;",
      "proxy_request_buffering off;",
      "proxy_read_timeout 3600s;",
      "proxy_send_timeout 3600s;",
      "client_max_body_size 64m;",
      "proxy_set_header Host $host;",
      "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
      "proxy_set_header Upgrade $http_upgrade;",
      "proxy_set_header Connection $connection_upgrade;",
      "NGINX_PROXY",
      "systemctl enable --now nginx",
      // --- direct TLS for the grey-clouded torii hostnames ----------------
      // HTTP-01 hits nginx :80 straight (DNS-only records point at the EIP);
      // --keep-until-expiring makes this a no-op while /data still has certs.
      `certbot certonly --webroot -w /var/www/certbot -d ${cfg.publicToriiHost} -d ${cfg.publicToriiEternumHost} --non-interactive --agree-tos -m jean.christophe.mehr@gmail.com --keep-until-expiring --deploy-hook 'systemctl reload nginx' || true`,
      `if [ -f /etc/letsencrypt/live/${cfg.publicToriiHost}/fullchain.pem ]; then`,
      "sed -i '$ d' /etc/nginx/nginx.conf",
      "cat >> /etc/nginx/nginx.conf <<'CONF443'",
      "  server {",
      `    listen 443 ssl; http2 on; server_name ${cfg.publicToriiHost};`,
      `    ssl_certificate /etc/letsencrypt/live/${cfg.publicToriiHost}/fullchain.pem;`,
      `    ssl_certificate_key /etc/letsencrypt/live/${cfg.publicToriiHost}/privkey.pem;`,
      "    location /.well-known/acme-challenge/ { root /var/www/certbot; }",
      "    location / { proxy_pass http://127.0.0.1:8081; include /etc/nginx/proxy-common.conf; }",
      "  }",
      "  server {",
      `    listen 443 ssl; http2 on; server_name ${cfg.publicToriiEternumHost};`,
      `    ssl_certificate /etc/letsencrypt/live/${cfg.publicToriiHost}/fullchain.pem;`,
      `    ssl_certificate_key /etc/letsencrypt/live/${cfg.publicToriiHost}/privkey.pem;`,
      "    location /.well-known/acme-challenge/ { root /var/www/certbot; }",
      "    location / { proxy_pass http://127.0.0.1:8082; include /etc/nginx/proxy-common.conf; }",
      "  }",
      "}",
      "CONF443",
      "nginx -t && systemctl reload nginx",
      "fi",
    );

    const katana = new ec2.Instance(this, "Katana", {
      vpc,
      vpcSubnets: { subnets: [katanaSubnet] },
      instanceType: new ec2.InstanceType(cfg.katanaInstanceType),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: katanaSg,
      role: katanaRole,
      userData,
      // User-data only runs on FIRST boot; without this a user-data edit is a
      // silent stop/start that never re-executes it. Replacement is exactly
      // what a chain remake wants (data-dir bumps birth the fresh chain).
      userDataCausesReplacement: true,
      requireImdsv2: true,
      associatePublicIpAddress: true,
    });
    new ec2.CfnVolumeAttachment(this, "KatanaDataAttach", {
      device: "/dev/sdf",
      instanceId: katana.instanceId,
      volumeId: dataVolume.volumeId,
    });
    // Stable public address: Cloudflare's A records point here (proxied), so
    // an instance replacement never needs a DNS change.
    const katanaEip = new ec2.CfnEIP(this, "KatanaEip", { domain: "vpc" });
    new ec2.CfnEIPAssociation(this, "KatanaEipAssociation", {
      allocationId: katanaEip.attrAllocationId,
      instanceId: katana.instanceId,
    });
    new cdk.CfnOutput(this, "KatanaPublicIp", {
      value: katanaEip.ref,
      description: "Cloudflare A-record target for katana/torii/torii-eternum.jcndata.com",
    });

    // --- torii config params: source of truth for the on-box toriis -----
    // (torii-refresh on the box fetches these; see the userData above.)
    const toriiS2ConfigParam = new ssm.StringParameter(this, "ToriiS2Config", {
      parameterName: "/realms-appchain/dev/torii-s2-config",
      description: "torii.toml for the vanilla single-world s2 torii (A3 runbook fills values)",
      stringValue: "# placeholder — replaced by the A3 runbook (deploy/appchain/torii-s2/render-config.ts)",
    });
    const toriiS2Logs = new logs.LogGroup(this, "ToriiS2Logs", {
      logGroupName: "/realms-appchain/dev/torii-s2",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const toriiEternumConfigParam = new ssm.StringParameter(this, "ToriiEternumConfig", {
      parameterName: "/realms-appchain/dev/torii-eternum-config",
      description: "torii.toml for the eternum-world torii (W4 runbook fills values)",
      stringValue: "# placeholder — replaced by the W4 runbook (deploy/appchain/torii-s2/render-config.ts)",
    });
    const toriiEternumLogs = new logs.LogGroup(this, "ToriiEternumLogs", {
      logGroupName: "/realms-appchain/dev/torii-eternum",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // --- Alarms ----------------------------------------------------------
    const alerts = new sns.Topic(this, "Alerts", {
      topicName: "realms-appchain-dev-alerts",
    });
    alerts.addSubscription(new subs.EmailSubscription(cfg.alertEmail));
    const notify = new cw_actions.SnsAction(alerts);

    const addAlarm = (id: string, alarm: cloudwatch.Alarm) => {
      alarm.addAlarmAction(notify);
      return alarm;
    };

    addAlarm(
      "KatanaStatusCheck",
      new cloudwatch.Alarm(this, "KatanaStatusCheckAlarm", {
        metric: new cloudwatch.Metric({
          namespace: "AWS/EC2",
          metricName: "StatusCheckFailed",
          dimensionsMap: { InstanceId: katana.instanceId },
          statistic: "Maximum",
          period: cdk.Duration.minutes(1),
        }),
        threshold: 1,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
        alarmDescription: "katana instance failing EC2 status checks",
      }),
    );

    // --- Game client hosting ---------------------------------------------
    // Static SPA in S3 website mode, fronted by Cloudflare for TLS. Not
    // CloudFront: it needs account verification AWS has not granted yet.
    const clientBucket = new s3.Bucket(this, "ClientBucket", {
      bucketName: cfg.publicClientHost,
      websiteIndexDocument: "index.html",
      // SPA: unknown routes must fall through to the app, not a 404 page.
      websiteErrorDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new cdk.CfnOutput(this, "ClientBucketWebsiteUrl", {
      value: clientBucket.bucketWebsiteDomainName,
      description: "CNAME target for the client host (proxied via Cloudflare)",
    });
    new cdk.CfnOutput(this, "ClientUrl", { value: `https://${cfg.publicClientHost}` });

    // --- Outputs ---------------------------------------------------------
    new cdk.CfnOutput(this, "KatanaUrl", { value: `https://${cfg.publicKatanaHost}` });
    new cdk.CfnOutput(this, "ToriiUrl", { value: `https://${cfg.publicToriiHost}` });
    new cdk.CfnOutput(this, "ToriiS2Direct", {
      value: `http://${katanaEip.ref}:8081`,
      description: "script/SQL access to the blitz torii (bypasses Cloudflare)",
    });
    new cdk.CfnOutput(this, "ToriiEternumDirect", {
      value: `http://${katanaEip.ref}:8082`,
      description: "script/SQL access to the eternum torii (bypasses Cloudflare)",
    });
    new cdk.CfnOutput(this, "KatanaInstanceId", { value: katana.instanceId });
  }
}
