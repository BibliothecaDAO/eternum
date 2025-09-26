locals {
  normalized_name = regex_replace(lower(var.name), "[^a-z0-9-]", "-")
  trimmed_name    = regex_replace(regex_replace(local.normalized_name, "^-+", ""), "-+$", "")
  secret_id       = substr("env-${local.trimmed_name}", 0, 255)
}

resource "google_secret_manager_secret" "this" {
  project   = var.project_id
  secret_id = local.secret_id
  labels    = var.labels

  replication {
    dynamic "user_managed" {
      for_each = var.replication_location == null ? [] : [var.replication_location]

      content {
        replicas {
          location = user_managed.value
        }
      }
    }

    dynamic "automatic" {
      for_each = var.replication_location == null ? [1] : []

      content {}
    }
  }
}

resource "google_secret_manager_secret_version" "seed" {
  count       = var.env_file_path == null ? 0 : 1
  secret      = google_secret_manager_secret.this.id
  secret_data = file(var.env_file_path)
}
