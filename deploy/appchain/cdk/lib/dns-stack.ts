import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { CONFIG } from "./config";

/**
 * The delegated public zone. Deploy this first, then add ONE NS record in the
 * realms.world DNS panel (Cloudflare): `appchain` -> the four name servers
 * from the NameServers output. Everything TLS-related in DevStack waits on
 * that record being live.
 */
export class DnsStack extends cdk.Stack {
  readonly zone: route53.PublicHostedZone;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.zone = new route53.PublicHostedZone(this, "Zone", {
      zoneName: CONFIG.zoneName,
    });

    new cdk.CfnOutput(this, "NameServers", {
      value: cdk.Fn.join(" ", this.zone.hostedZoneNameServers ?? []),
      description: "Add these as an NS record for 'appchain' in realms.world DNS",
    });
  }
}
