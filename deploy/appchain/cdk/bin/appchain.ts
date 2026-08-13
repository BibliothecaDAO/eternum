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
new DnsStack(app, "RealmsAppchainDns", { env });

new DevStack(app, "RealmsAppchainDev", {
  env,
  katanaRepo: foundation.katanaRepo,
});
