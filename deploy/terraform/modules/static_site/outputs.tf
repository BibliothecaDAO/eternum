output "bucket_name" {
  description = "Storage bucket hosting the site"
  value       = google_storage_bucket.site.name
}

output "cdn_ip" {
  description = "Global IP address serving the site"
  value       = google_compute_global_forwarding_rule.https.ip_address
}

output "domain" {
  description = "Domain mapped to the site"
  value       = var.domain
}

output "certificate_status" {
  description = "Managed certificate provisioning status"
  value       = google_compute_managed_ssl_certificate.site.managed_status
}

output "bucket_url" {
  description = "Direct bucket URL for debugging"
  value       = "https://storage.googleapis.com/${google_storage_bucket.site.name}"
}
