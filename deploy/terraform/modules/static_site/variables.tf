variable "project_id" {
  description = "GCP project that owns the static site resources"
  type        = string
}

variable "name" {
  description = "Logical name used for resource naming"
  type        = string
}

variable "domain" {
  description = "Fully qualified domain that should serve the site"
  type        = string
}

variable "dns_zone_name" {
  description = "Cloud DNS zone that will receive the A record"
  type        = string
}

variable "dns_project_id" {
  description = "Optional project that owns the DNS zone"
  type        = string
  default     = null
}

variable "bucket_location" {
  description = "Location for the Cloud Storage bucket"
  type        = string
  default     = "US"
}

variable "bucket_name" {
  description = "Explicit Cloud Storage bucket name. Leave blank to derive from project and name."
  type        = string
  default     = ""
}

variable "force_destroy" {
  description = "Allow Terraform to delete the bucket even when it is not empty"
  type        = bool
  default     = false
}

variable "labels" {
  description = "Labels applied to created resources"
  type        = map(string)
  default     = {}
}

variable "certificate_domains" {
  description = "Domains covered by the managed certificate"
  type        = list(string)
  default     = []
}

variable "create_dns_record" {
  description = "Whether Terraform should create the DNS A record"
  type        = bool
  default     = true
}

variable "enable_cdn" {
  description = "Enable Cloud CDN on the backend bucket"
  type        = bool
  default     = true
}
