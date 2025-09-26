variable "project_id" {
  description = "Primary GCP project id that will own the infrastructure"
  type        = string
}

variable "default_region" {
  description = "Default region for regional resources"
  type        = string
  default     = "us-central1"
}

variable "default_location" {
  description = "Default location for multi-region resources such as Cloud Storage"
  type        = string
  default     = "US"
}

variable "default_labels" {
  description = "Labels applied to every managed resource"
  type        = map(string)
  default     = {}
}

variable "environments" {
  description = "Per-environment configuration for static sites"
  type = map(object({
    app_id                      = optional(string)
    domain                      = string
    dns_zone_name               = string
    dns_project_id              = optional(string)
    bucket_location             = optional(string)
    bucket_name                 = optional(string)
    certificate_domains         = optional(list(string))
    force_destroy               = optional(bool)
    labels                      = optional(map(string))
    create_dns_record           = optional(bool)
    enable_cdn                  = optional(bool)
    env_file_path               = optional(string)
    secret_replication_location = optional(string)
  }))
  default = {}
}

variable "apis" {
  description = "Google APIs that must be enabled on the project"
  type        = list(string)
  default = [
    "compute.googleapis.com",
    "dns.googleapis.com",
    "iam.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com"
  ]
}

variable "create_ci_service_account" {
  description = "Create a dedicated service account for CI driven deployments"
  type        = bool
  default     = true
}

variable "ci_service_account_name" {
  description = "Service account id (not email) used for CI automation"
  type        = string
  default     = "terraform-deployer"
}

variable "ci_service_account_display_name" {
  description = "Display name for the CI service account"
  type        = string
  default     = "Terraform Deployer"
}

variable "ci_service_account_roles" {
  description = "IAM roles granted to the CI service account"
  type        = list(string)
  default = [
    "roles/compute.loadBalancerAdmin",
    "roles/dns.admin",
    "roles/secretmanager.admin",
    "roles/storage.admin"
  ]
}
