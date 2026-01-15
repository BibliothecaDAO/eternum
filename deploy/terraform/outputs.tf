output "static_sites" {
  description = "Static site resources keyed by environment"
  value = {
    for name, site in module.static_sites :
    name => {
      bucket_name        = site.bucket_name
      domain             = site.domain
      global_ip          = site.cdn_ip
      certificate_status = site.certificate_status
      bucket_url         = site.bucket_url
    }
  }
}

output "ci_service_account_email" {
  description = "Service account used by CI to run Terraform"
  value       = var.create_ci_service_account ? google_service_account.ci[0].email : null
}

output "env_secrets" {
  description = "Secret Manager resources that hold per-environment env files"
  value = {
    for name, secret in module.env_secrets :
    name => {
      secret_id       = secret.secret_id
      secret_resource = secret.secret_resource
    }
  }
}
