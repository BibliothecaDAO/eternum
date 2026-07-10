locals {
  environment_id = "mainnet.blitz"
  account_class  = "production"
  aws_region     = "us-east-1"
  project_name   = "eternum-mainnet-blitz-runtime"
}

variable "hosted_zone_id" {
  type = string
}

variable "github_org" {
  type = string
}

variable "github_repo" {
  type = string
}

variable "github_oidc_provider_arn" {
  type = string
}

variable "monthly_budget_usd" {
  type = number
}

variable "domain_name" {
  type    = string
  default = "runtime.realms.world"
}

variable "alert_email_addresses" {
  type    = list(string)
  default = []
}

variable "alert_webhook_url" {
  type    = string
  default = null
}

variable "budget_notification_email_addresses" {
  type    = list(string)
  default = []
}

variable "cors_origins" {
  type = list(string)
}

variable "runtime_shard_count" {
  type    = number
  default = 1
}

variable "waf_enforcement_mode" {
  type    = string
  default = "block"
}

variable "backup_copy_vault_arn" {
  type    = string
  default = null
}

variable "backup_kms_key_arn" {
  type    = string
  default = null
}

variable "dr_account_id" {
  type    = string
  default = null
}

variable "production_account_id" {
  type    = string
  default = null
}

variable "image_pull_principal_arns" {
  type    = list(string)
  default = []
}

variable "candidate_ecr_repository_arns" {
  type = list(string)
}

variable "efs_replica_file_system_id" {
  type    = string
  default = null
}

module "runtime_environment" {
  source = "../.."

  aws_region                          = local.aws_region
  project_name                        = local.project_name
  environment_id                      = local.environment_id
  account_class                       = local.account_class
  domain_name                         = var.domain_name
  hosted_zone_id                      = var.hosted_zone_id
  github_org                          = var.github_org
  github_repo                         = var.github_repo
  github_oidc_provider_arn            = var.github_oidc_provider_arn
  github_environment                  = local.environment_id
  alert_email_addresses               = var.alert_email_addresses
  alert_webhook_url                   = var.alert_webhook_url
  budget_notification_email_addresses = var.budget_notification_email_addresses
  monthly_budget_usd                  = var.monthly_budget_usd
  runtime_shard_count                 = var.runtime_shard_count
  waf_enforcement_mode                = var.waf_enforcement_mode
  cors_origins                        = var.cors_origins
  backup_copy_vault_arn               = var.backup_copy_vault_arn
  backup_kms_key_arn                  = var.backup_kms_key_arn
  dr_account_id                       = var.dr_account_id
  production_account_id               = var.production_account_id
  image_pull_principal_arns           = var.image_pull_principal_arns
  candidate_ecr_repository_arns       = var.candidate_ecr_repository_arns
  efs_replica_file_system_id          = var.efs_replica_file_system_id
  upstream_rpc_secret_name            = "eternum/runtime/${replace(local.environment_id, ".", "-")}/upstream-rpc"
}

output "github_environment_variables" {
  value = module.runtime_environment.github_environment_variables
}

output "dr_workflow_environment_variables" {
  value = module.runtime_environment.dr_workflow_environment_variables
}
