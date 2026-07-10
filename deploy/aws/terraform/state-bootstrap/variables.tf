variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "state_bucket_name" {
  type = string
}

variable "lock_table_name" {
  type    = string
  default = "aws-runtime-foundation-locks"
}

variable "replication_destination_bucket_arn" {
  description = "Optional isolated DR-account state bucket ARN in us-west-2."
  type        = string
  default     = null
}

variable "replication_destination_kms_key_arn" {
  description = "KMS key ARN encrypting replicas in the isolated DR account."
  type        = string
  default     = null
}

variable "replication_source_role_arn" {
  description = "Optional source-account replication role allowed to write into this destination bucket and KMS key."
  type        = string
  default     = null
}

variable "enable_state_replication" {
  description = "Enable the source bucket replication rule after the DR bucket trusts replication_role_arn."
  type        = bool
  default     = false
}

variable "environment_class" {
  type = string

  validation {
    condition     = contains(["non-production", "production", "dr"], var.environment_class)
    error_message = "environment_class must be non-production, production, or dr."
  }
}

variable "ecr_replication_peer_account_id" {
  description = "DR destination account for production, or production source account for DR."
  type        = string
  default     = null

  validation {
    condition     = var.ecr_replication_peer_account_id == null || can(regex("^[0-9]{12}$", var.ecr_replication_peer_account_id))
    error_message = "ecr_replication_peer_account_id must be a 12-digit AWS account ID."
  }
}

variable "ecr_replication_destination_region" {
  description = "Region receiving production runtime image replicas."
  type        = string
  default     = "us-west-2"

  validation {
    condition     = var.ecr_replication_destination_region == "us-west-2"
    error_message = "Runtime DR ECR replication must target us-west-2."
  }
}

variable "enable_ecr_replication" {
  description = "Enable production registry replication after hardened DR repositories have been pre-created."
  type        = bool
  default     = false
}

variable "ecr_replication_repository_prefixes" {
  description = "Production runtime repository prefixes allowed to replicate into the DR registry."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for prefix in var.ecr_replication_repository_prefixes : can(regex("^[a-z0-9]+(?:[._/-][a-z0-9]+)*-?$", prefix))
    ])
    error_message = "ECR replication prefixes must be canonical repository-name prefixes."
  }
}
