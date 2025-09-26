variable "project_id" {
  description = "GCP project where the secret will be created"
  type        = string
}

variable "name" {
  description = "Logical name used to derive the secret identifier"
  type        = string
}

variable "env_file_path" {
  description = "Path to the local env file that should seed the secret. If null only the secret container is created."
  type        = string
  default     = null
}

variable "replication_location" {
  description = "Optional Secret Manager replication location"
  type        = string
  default     = null
}

variable "labels" {
  description = "Labels to attach to the secret"
  type        = map(string)
  default     = {}
}
