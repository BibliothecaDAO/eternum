#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { FoundationStack } from "../lib/foundation-stack";
import { DnsStack } from "../lib/dns-stack";
import { DevStack } from "../lib/dev-stack";

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const foundation = new FoundationStack(app, "RealmsAppchainFoundation", { env });
const dns = new DnsStack(app, "RealmsAppchainDns", { env });

// Deployable only after (a) the NS delegation for appchain.realms.world is
// live (ACM cert validation waits on it) and (b) the EC2 vCPU quota covers the
// katana instance.
new DevStack(app, "RealmsAppchainDev", {
  env,
  zone: dns.zone,
  katanaRepo: foundation.katanaRepo,
  toriiRepo: foundation.toriiRepo,
  toriiAdminToken: foundation.toriiAdminToken,
});
