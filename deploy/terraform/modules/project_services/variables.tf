variable "project_id" {
  description = "GCP project ID to enable services for"
  type        = string
}

variable "services" {
  description = "List of Google APIs to enable on the project"
  type        = list(string)
}
