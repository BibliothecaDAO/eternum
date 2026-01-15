output "secret_id" {
  description = "Secret identifier"
  value       = google_secret_manager_secret.this.secret_id
}

output "secret_resource" {
  description = "Resource name of the secret"
  value       = google_secret_manager_secret.this.name
}
