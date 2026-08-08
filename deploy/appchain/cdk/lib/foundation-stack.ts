import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { CONFIG } from "./config";

/**
 * Account-level plumbing with no dependency on DNS delegation or EC2 quota:
 * ECR repositories for our two custom images and the GitHub OIDC roles.
 * Deployable on day zero.
 */
export class FoundationStack extends cdk.Stack {
  readonly katanaRepo: ecr.Repository;
  readonly toriiRepo: ecr.Repository;
  readonly toriiAdminToken: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lifecycle: ecr.LifecycleRule = {
      description: "keep last 10 images",
      maxImageCount: 10,
    };
    this.katanaRepo = new ecr.Repository(this, "KatanaRepo", {
      repositoryName: CONFIG.ecr.katanaRepo,
      lifecycleRules: [lifecycle],
    });
    this.toriiRepo = new ecr.Repository(this, "ToriiRepo", {
      repositoryName: CONFIG.ecr.toriiRepo,
      lifecycleRules: [lifecycle],
    });
    this.toriiAdminToken = new secretsmanager.Secret(this, "ToriiAdminToken", {
      secretName: "/realms-appchain/dev/torii-admin-token",
      description: "Bearer token for Torii's dynamic contract management API",
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 48,
      },
    });

    // --- GitHub OIDC -----------------------------------------------------
    // The account already carries a github OIDC provider (audience
    // sts.amazonaws.com) — providers are account-singletons, import it.
    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      "GithubOidc",
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
    );

    const githubPrincipal = new iam.OpenIdConnectPrincipal(provider, {
      StringEquals: {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      },
      StringLike: {
        "token.actions.githubusercontent.com:sub": `repo:${CONFIG.githubRepo}:*`,
      },
    });

    // Infra deploys: assume the CDK bootstrap roles (standard CDK CI pattern —
    // the bootstrap roles carry the actual permissions).
    const deployRole = new iam.Role(this, "GhaDeployRole", {
      roleName: "gha-appchain-deploy",
      assumedBy: githubPrincipal,
      description: "GitHub Actions: cdk deploy via bootstrap roles",
    });
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );

    // Image builds: push to our two repos only.
    const imageRole = new iam.Role(this, "GhaImageRole", {
      roleName: "gha-appchain-image",
      assumedBy: githubPrincipal,
      description: "GitHub Actions: build + push appchain images",
    });
    imageRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      }),
    );
    this.katanaRepo.grantPullPush(imageRole);
    this.toriiRepo.grantPullPush(imageRole);

    // Game launches: persist the desired world list and hot-add the world to
    // the running indexer. No ECS mutation is needed for a normal launch.
    const launchRole = new iam.Role(this, "GhaLaunchRole", {
      roleName: "gha-appchain-launch",
      assumedBy: githubPrincipal,
      description: "GitHub Actions: persist and hot-add appchain Torii worlds",
    });
    launchRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:PutParameter"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/realms-appchain/*`,
        ],
      }),
    );
    this.toriiAdminToken.grantRead(launchRole);

    new cdk.CfnOutput(this, "DeployRoleArn", { value: deployRole.roleArn });
    new cdk.CfnOutput(this, "ImageRoleArn", { value: imageRole.roleArn });
    new cdk.CfnOutput(this, "LaunchRoleArn", { value: launchRole.roleArn });
    new cdk.CfnOutput(this, "ToriiAdminTokenArn", {
      value: this.toriiAdminToken.secretArn,
    });
    new cdk.CfnOutput(this, "KatanaRepoUri", { value: this.katanaRepo.repositoryUri });
    new cdk.CfnOutput(this, "ToriiRepoUri", { value: this.toriiRepo.repositoryUri });
  }
}
