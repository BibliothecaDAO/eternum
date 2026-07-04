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

variable "domain_name" {
  description = "Public runtime domain."
  type        = string
  default     = "runtime.realms.world"
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone id for domain validation and alias records."
  type        = string
}

variable "github_org" {
  description = "GitHub organization allowed to assume the runtime deploy role."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository allowed to assume the runtime deploy role."
  type        = string
}

variable "github_environments" {
  description = "GitHub environments allowed to assume the runtime deploy role."
  type        = list(string)
  default     = ["slot.blitz", "slot.eternum", "mainnet.blitz", "mainnet.eternum"]
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
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private ECS and EFS subnets."
  type        = list(string)
  default     = ["10.80.10.0/24", "10.80.11.0/24"]
}
