import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as elbv2_targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import { CONFIG } from "./config";

export interface DevStackProps extends cdk.StackProps {
  zone: route53.IPublicHostedZone;
  katanaRepo: ecr.IRepository;
  toriiRepo: ecr.IRepository;
}

/**
 * The Phase 1 dev appchain: sovereign katana (EC2 + instance-attached EBS so
 * a resize never resets the chain), ONE multi-world torii (Fargate), a single
 * host-routed ALB with ACM TLS and a WAF rate limit, public subnets only (no
 * NAT — tasks get public IPs, inbound is SG-locked to the ALB).
 */
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

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: "realms-appchain-dev",
    });

    // --- ALB + TLS + WAF -------------------------------------------------
    const albSg = new ec2.SecurityGroup(this, "AlbSg", {
      vpc,
      description: "appchain dev ALB",
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "katana rpc / http");
    if (cfg.tls) {
      albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "https");
    } else {
      albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080), "torii (http mode)");
    }

    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      // long-poll / websocket friendliness (cagecalls used 4000s)
      idleTimeout: cdk.Duration.seconds(3600),
    });

    // tls mode: one 443 listener, host-header routing, 80 redirects.
    // http mode (no DNS access yet): port routing — :80 katana, :8080 torii.
    // HTTP/1.1 target groups everywhere — h2 target groups reject
    // non-browser clients with 464 (cagecalls production incident).
    let routeListener: elbv2.ApplicationListener;
    if (cfg.tls) {
      const cert = new acm.Certificate(this, "Cert", {
        domainName: cfg.certWildcard,
        validation: acm.CertificateValidation.fromDns(props.zone),
      });
      alb.addListener("Http", {
        port: 80,
        defaultAction: elbv2.ListenerAction.redirect({
          protocol: "HTTPS",
          port: "443",
          permanent: true,
        }),
      });
      routeListener = alb.addListener("Https", {
        port: 443,
        certificates: [cert],
        defaultAction: elbv2.ListenerAction.fixedResponse(404, {
          contentType: "text/plain",
          messageBody: "unknown host",
        }),
      });
    } else {
      routeListener = alb.addListener("Http", {
        port: 80,
        defaultAction: elbv2.ListenerAction.fixedResponse(404, {
          contentType: "text/plain",
          messageBody: "katana on :80 via target group, torii on :8080",
        }),
      });
    }

    const waf = new wafv2.CfnWebACL(this, "Waf", {
      defaultAction: { allow: {} },
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "realms-appchain-dev",
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "rate-limit-per-ip",
          priority: 0,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: cfg.wafRateLimit,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "rate-limit-per-ip",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });
    new wafv2.CfnWebACLAssociation(this, "WafAssoc", {
      resourceArn: alb.loadBalancerArn,
      webAclArn: waf.attrArn,
    });

    // --- Katana: EC2 singleton ------------------------------------------
    const katanaSubnet = vpc.publicSubnets[0];

    const katanaSg = new ec2.SecurityGroup(this, "KatanaSg", {
      vpc,
      description: "katana sequencer",
      allowAllOutbound: true,
    });
    katanaSg.addIngressRule(albSg, ec2.Port.tcp(5050), "rpc from alb");

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
      "mkdir -p /data/katana-db-v1",
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
        `/bin/sh -c 'exec katana --config /config/katana.toml --data-dir /data/katana-db-v1 --chain-id ${cfg.chainId} --cartridge.controllers --paymaster --cartridge.paymaster --paymaster.bin /usr/local/bin/paymaster-service --vrf --vrf.bin /usr/local/bin/vrf-server-untagged'`,
      ].join(" "),
      // Heartbeat: mine an empty block while idle (--block-time is broken on
      // rc.9). Host network so a katana container restart can't strand it.
      [
        "docker run -d --name heartbeat --restart=always --network host",
        `--log-driver=awslogs --log-opt awslogs-group=${katanaLogs.logGroupName} --log-opt awslogs-stream=heartbeat --log-opt awslogs-region=${this.region}`,
        image,
        `/bin/sh -c 'while true; do curl -sf -m 10 -o /dev/null -X POST -H "content-type: application/json" -d "{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"dev_generateBlock\\",\\"params\\":[]}" http://127.0.0.1:5050 || true; sleep ${cfg.heartbeatSeconds}; done'`,
      ].join(" "),
    );

    const katana = new ec2.Instance(this, "Katana", {
      vpc,
      vpcSubnets: { subnets: [katanaSubnet] },
      instanceType: new ec2.InstanceType(cfg.katanaInstanceType),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: katanaSg,
      role: katanaRole,
      userData,
      requireImdsv2: true,
      associatePublicIpAddress: true,
    });
    new ec2.CfnVolumeAttachment(this, "KatanaDataAttach", {
      device: "/dev/sdf",
      instanceId: katana.instanceId,
      volumeId: dataVolume.volumeId,
    });

    const katanaTg = new elbv2.ApplicationTargetGroup(this, "KatanaTg", {
      vpc,
      port: 5050,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      targets: [new elbv2_targets.InstanceTarget(katana, 5050)],
      healthCheck: {
        path: "/",
        // JSON-RPC answers GET with 405 — that still proves liveness.
        healthyHttpCodes: "200-499",
        interval: cdk.Duration.seconds(15),
      },
      deregistrationDelay: cdk.Duration.seconds(10),
    });
    if (cfg.tls) {
      routeListener.addAction("KatanaRoute", {
        priority: 10,
        conditions: [elbv2.ListenerCondition.hostHeaders([cfg.katanaHost])],
        action: elbv2.ListenerAction.forward([katanaTg]),
      });
    } else {
      // Cloudflare proxies both hostnames to :80, so route by Host header.
      routeListener.addAction("KatanaPublicHost", {
        priority: 5,
        conditions: [elbv2.ListenerCondition.hostHeaders([cfg.publicKatanaHost])],
        action: elbv2.ListenerAction.forward([katanaTg]),
      });
      // Anything else on :80 is katana too (direct ALB access for CLI tools).
      routeListener.addAction("KatanaDefault", {
        priority: 10,
        conditions: [elbv2.ListenerCondition.pathPatterns(["*"])],
        action: elbv2.ListenerAction.forward([katanaTg]),
      });
    }

    // --- Torii: ONE multi-world indexer (Fargate) -----------------------
    // Config (the WORLD list) lives in SSM and is injected as an env var at
    // task start — the launch flow appends a world and forces a new
    // deployment; no task-definition churn, no CLI needed in the container.
    const toriiConfigParam = new ssm.StringParameter(this, "ToriiConfig", {
      parameterName: "/realms-appchain/dev/torii-config",
      description: "torii.toml for the shared multi-world torii (M2 bootstrap fills contracts)",
      stringValue: [
        "# placeholder — replaced by the M2 chain-bootstrap runbook",
        cfg.tls
          ? `rpc = "https://${cfg.katanaHost}"`
          : "# rpc = filled by M2 with the ALB http url",
        'db_dir = "/data/torii-db-v1"',
        "",
        "[indexing]",
        "pending = true",
        "polling_interval = 250",
        "controllers = true",
        "pre_confirmed = true",
        "transactions = true",
        "contracts = []",
        'namespaces = ["s1_eternum"]',
        "world_block = 0",
        "",
        "[events]",
        "raw = true",
        "",
        "[erc]",
        "max_metadata_tasks = 10",
      ].join("\n"),
    });

    const toriiLogs = new logs.LogGroup(this, "ToriiLogs", {
      logGroupName: "/realms-appchain/dev/torii",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const toriiTask = new ecs.FargateTaskDefinition(this, "ToriiTask", {
      cpu: cfg.toriiCpu,
      memoryLimitMiB: cfg.toriiMemoryMib,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    toriiTask.addContainer("torii", {
      image: ecs.ContainerImage.fromEcrRepository(props.toriiRepo, CONFIG.ecr.toriiTag),
      logging: ecs.LogDrivers.awsLogs({ logGroup: toriiLogs, streamPrefix: "torii" }),
      entryPoint: ["/bin/sh", "-c"],
      command: [
        'mkdir -p /data && printf \'%s\' "$TORII_CONFIG" > /tmp/torii.toml && exec torii --config /tmp/torii.toml --http.addr 0.0.0.0 --http.port 8080 --http.cors_origins "*"',
      ],
      secrets: {
        TORII_CONFIG: ecs.Secret.fromSsmParameter(toriiConfigParam),
      },
      portMappings: [{ containerPort: 8080 }],
    });

    const toriiSg = new ec2.SecurityGroup(this, "ToriiSg", {
      vpc,
      description: "shared torii",
      allowAllOutbound: true,
    });

    const torii = new ecs.FargateService(this, "Torii", {
      cluster,
      serviceName: "torii",
      taskDefinition: toriiTask,
      // 0 until the M2 bootstrap writes a real config (an empty world list is
      // useless); flipped to 1 by the runbook.
      desiredCount: 0,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [toriiSg],
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      circuitBreaker: { rollback: true },
      enableExecuteCommand: true,
    });

    const toriiTg = new elbv2.ApplicationTargetGroup(this, "ToriiTg", {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/",
        healthyHttpCodes: "200-499",
        interval: cdk.Duration.seconds(15),
      },
      deregistrationDelay: cdk.Duration.seconds(10),
    });
    toriiTg.addTarget(torii);
    if (cfg.tls) {
      routeListener.addAction("ToriiRoute", {
        priority: 20,
        conditions: [elbv2.ListenerCondition.hostHeaders([cfg.toriiHost])],
        action: elbv2.ListenerAction.forward([toriiTg]),
      });
      // --- DNS -----------------------------------------------------------
      new route53.ARecord(this, "KatanaRecord", {
        zone: props.zone,
        recordName: "katana.dev",
        target: route53.RecordTarget.fromAlias(new r53_targets.LoadBalancerTarget(alb)),
      });
      new route53.ARecord(this, "ToriiRecord", {
        zone: props.zone,
        recordName: "torii.dev",
        target: route53.RecordTarget.fromAlias(new r53_targets.LoadBalancerTarget(alb)),
      });
    } else {
      // Cloudflare only proxies a fixed set of origin ports, and :8080 is one
      // of them — but routing torii by Host on :80 keeps both hostnames on the
      // same standard port, which is simpler and avoids per-record port rules.
      routeListener.addAction("ToriiPublicHost", {
        priority: 4,
        conditions: [elbv2.ListenerCondition.hostHeaders([cfg.publicToriiHost])],
        action: elbv2.ListenerAction.forward([toriiTg]),
      });
      // Keep :8080 for direct ALB access (CLI/scripts bypass Cloudflare).
      alb.addListener("ToriiHttp", {
        port: 8080,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.forward([toriiTg]),
      });
    }

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
    addAlarm(
      "KatanaUnhealthy",
      new cloudwatch.Alarm(this, "KatanaUnhealthyAlarm", {
        metric: katanaTg.metrics.unhealthyHostCount(),
        threshold: 1,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: "katana RPC unhealthy behind the ALB",
      }),
    );
    addAlarm(
      "ToriiUnhealthy",
      new cloudwatch.Alarm(this, "ToriiUnhealthyAlarm", {
        metric: toriiTg.metrics.unhealthyHostCount(),
        threshold: 1,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        // desiredCount starts at 0 — no hosts is not an incident
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: "torii unhealthy behind the ALB",
      }),
    );
    addAlarm(
      "Alb5xx",
      new cloudwatch.Alarm(this, "Alb5xxAlarm", {
        metric: alb.metrics.httpCodeElb(elbv2.HttpCodeElb.ELB_5XX_COUNT, {
          period: cdk.Duration.minutes(5),
          statistic: "Sum",
        }),
        threshold: 20,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: "ALB returning 5xx",
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
    new cdk.CfnOutput(this, "KatanaUrl", {
      value: cfg.tls ? `https://${cfg.katanaHost}` : `http://${alb.loadBalancerDnsName}`,
    });
    new cdk.CfnOutput(this, "ToriiUrl", {
      value: cfg.tls ? `https://${cfg.toriiHost}` : `http://${alb.loadBalancerDnsName}:8080`,
    });
    new cdk.CfnOutput(this, "KatanaInstanceId", { value: katana.instanceId });
    new cdk.CfnOutput(this, "ToriiServiceName", { value: torii.serviceName });
    new cdk.CfnOutput(this, "ToriiConfigParam", { value: toriiConfigParam.parameterName });
    new cdk.CfnOutput(this, "AlbDns", { value: alb.loadBalancerDnsName });
  }
}
