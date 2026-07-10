variable "aws_region" {
  description = "AWS region for the runtime foundation."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name prefix for shared runtime resources."
  type        = string
  default     = "eternum-game-runtime"
}

variable "environment_id" {
  description = "Exact runtime environment owned by this isolated foundation."
  type        = string

  validation {
    condition = contains([
      "slot.blitz",
      "slot.eternum",
      "slottest.blitz",
      "slottest.eternum",
      "mainnet.blitz",
      "mainnet.eternum"
    ], var.environment_id)
    error_message = "environment_id must be one supported deployment environment."
  }
}

variable "account_class" {
  description = "AWS account boundary hosting this foundation."
  type        = string

  validation {
    condition     = contains(["non-production", "production", "dr"], var.account_class)
    error_message = "account_class must be non-production, production, or dr."
  }
}

variable "domain_name" {
  description = "Public runtime domain."
  type        = string
  default     = "runtime.realms.world"
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone id for domain validation and alias records."
  type        = string
}

variable "existing_certificate_arn" {
  description = "Optional ACM certificate ARN already validated in this foundation's region and account."
  type        = string
  default     = null
}

variable "manage_public_dns" {
  description = "Whether this foundation owns the public shard aliases. DR foundations leave aliases to the recovery workflow."
  type        = bool
  default     = true
}

variable "github_org" {
  description = "GitHub organization allowed to assume the runtime deploy role."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository allowed to assume the runtime deploy role."
  type        = string
}

variable "github_oidc_provider_arn" {
  description = "Account-owned GitHub Actions OIDC provider ARN created once by state-bootstrap."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:iam::[0-9]{12}:oidc-provider/token\\.actions\\.githubusercontent\\.com$", var.github_oidc_provider_arn))
    error_message = "github_oidc_provider_arn must be a GitHub Actions OIDC provider ARN."
  }
}

variable "github_environment" {
  description = "The one exact GitHub environment allowed to assume this foundation's roles."
  type        = string

  validation {
    condition     = !strcontains(var.github_environment, "*")
    error_message = "github_environment must be one exact GitHub environment, not a wildcard."
  }
}

variable "alert_email_addresses" {
  description = "Email endpoints subscribed to runtime foundation alerts."
  type        = list(string)
  default     = []
}

variable "alert_webhook_url" {
  description = "Optional HTTPS webhook endpoint subscribed to runtime foundation alerts."
  type        = string
  default     = null
}

variable "budget_notification_email_addresses" {
  description = "Email endpoints receiving 50/80/100/120 percent budget notifications."
  type        = list(string)
  default     = []
}

variable "monthly_budget_usd" {
  description = "Approved monthly runtime budget for this environment."
  type        = number

  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "monthly_budget_usd must be greater than zero."
  }
}

variable "runtime_shard_count" {
  description = "Number of append-only ALB shards. Decreasing this value is blocked by ALB deletion protection."
  type        = number
  default     = 1

  validation {
    condition     = var.runtime_shard_count >= 1 && var.runtime_shard_count <= 20
    error_message = "runtime_shard_count must be between 1 and 20."
  }
}

variable "waf_enforcement_mode" {
  description = "Use count during shadow traffic and block before production cutover."
  type        = string
  default     = "count"

  validation {
    condition     = contains(["count", "block"], var.waf_enforcement_mode)
    error_message = "waf_enforcement_mode must be count or block."
  }
}

variable "cors_origins" {
  description = "Explicit browser origins accepted by the runtime proxy."
  type        = list(string)

  validation {
    condition = length(var.cors_origins) > 0 && alltrue([
      for origin in var.cors_origins : can(regex("^(https://[^/]+|http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?)$", origin))
    ])
    error_message = "cors_origins must contain at least one explicit HTTPS origin or localhost development origin, without a path."
  }
}

variable "backup_copy_vault_arn" {
  description = "Cross-account us-west-2 AWS Backup vault ARN for production recovery point copies."
  type        = string
  default     = null

  validation {
    condition = var.backup_copy_vault_arn == null || can(regex(
      "^arn:aws:backup:us-west-2:[0-9]{12}:backup-vault:[A-Za-z0-9_-]{2,50}$",
      var.backup_copy_vault_arn
    ))
    error_message = "backup_copy_vault_arn must identify a us-west-2 AWS Backup vault."
  }
}

variable "dr_account_id" {
  description = "Isolated backup/DR AWS account receiving production ECR and backup replicas."
  type        = string
  default     = null

  validation {
    condition     = var.dr_account_id == null || can(regex("^[0-9]{12}$", var.dr_account_id))
    error_message = "dr_account_id must be a 12-digit AWS account ID."
  }
}

variable "production_account_id" {
  description = "Production AWS account allowed to replicate images into a DR foundation."
  type        = string
  default     = null

  validation {
    condition     = var.production_account_id == null || can(regex("^[0-9]{12}$", var.production_account_id))
    error_message = "production_account_id must be a 12-digit AWS account ID."
  }
}

variable "image_pull_principal_arns" {
  description = "Cross-account production image-role ARNs allowed to pull signed candidates from this repository."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for arn in var.image_pull_principal_arns : can(regex("^arn:aws:iam::[0-9]{12}:role/[A-Za-z0-9+=,.@_/-]+$", arn))
    ])
    error_message = "image_pull_principal_arns must contain IAM role ARNs."
  }
}

variable "candidate_ecr_repository_arns" {
  description = "Non-production candidate ECR repositories the production image role may verify and pull from."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for arn in var.candidate_ecr_repository_arns : can(regex("^arn:aws:ecr:[a-z0-9-]+:[0-9]{12}:repository/[a-z0-9._/-]+$", arn))
    ])
    error_message = "candidate_ecr_repository_arns must contain private ECR repository ARNs."
  }
}

variable "ecr_repository_name" {
  description = "Optional ECR repository name override, used by DR roots to pre-create the production replication target."
  type        = string
  default     = null

  validation {
    condition     = var.ecr_repository_name == null || can(regex("^[a-z0-9]+(?:[._/-][a-z0-9]+)*$", var.ecr_repository_name))
    error_message = "ecr_repository_name must be a canonical private ECR repository name."
  }
}

variable "efs_replica_file_system_id" {
  description = "Existing us-west-2 DR-account EFS file system used by cross-account replication."
  type        = string
  default     = null

  validation {
    condition     = var.efs_replica_file_system_id == null || can(regex("^fs-[0-9a-f]{8,40}$", var.efs_replica_file_system_id))
    error_message = "efs_replica_file_system_id must be an EFS file system ID."
  }
}

variable "backup_kms_key_arn" {
  description = "Optional customer-managed KMS key for the local backup vault."
  type        = string
  default     = null
}

variable "upstream_rpc_secret_name" {
  description = "Optional environment secret name whose value is managed outside Terraform."
  type        = string
  default     = null
}

variable "enable_vpc_endpoints" {
  description = "Create private S3, ECR, and CloudWatch Logs endpoints for runtime tasks."
  type        = bool
  default     = true
}

variable "vpc_cidr" {
  description = "CIDR block for the runtime VPC."
  type        = string
  default     = "10.80.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public ALB subnets."
  type        = list(string)
  default     = ["10.80.0.0/24", "10.80.1.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2 && length(distinct(var.public_subnet_cidrs)) == 2
    error_message = "public_subnet_cidrs must contain two distinct CIDRs for the two-AZ foundation."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private ECS and EFS subnets."
  type        = list(string)
  default     = ["10.80.10.0/24", "10.80.11.0/24"]

  validation {
    condition     = length(var.private_subnet_cidrs) == 2 && length(distinct(var.private_subnet_cidrs)) == 2
    error_message = "private_subnet_cidrs must contain two distinct CIDRs for the two-AZ foundation."
  }
}
