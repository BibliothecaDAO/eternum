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

variable "github_environment" {
  description = "Optional GitHub environment restriction. Use * to allow any environment."
  type        = string
  default     = "*"
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
