locals {
  normalized_environments = {
    for name, cfg in var.environments :
    name => {
      app_id                      = coalesce(try(cfg.app_id, null), name)
      domain                      = cfg.domain
      dns_zone_name               = cfg.dns_zone_name
      dns_project_id              = try(cfg.dns_project_id, null)
      bucket_location             = coalesce(try(cfg.bucket_location, null), var.default_location)
      bucket_name                 = coalesce(try(cfg.bucket_name, null), "")
      certificate_domains         = try(cfg.certificate_domains, [])
      force_destroy               = try(cfg.force_destroy, false)
      labels                      = merge(var.default_labels, try(cfg.labels, {}), { environment = name })
      create_dns_record           = try(cfg.create_dns_record, true)
      enable_cdn                  = try(cfg.enable_cdn, true)
      env_file_path               = try(cfg.env_file_path, null)
      secret_replication_location = try(cfg.secret_replication_location, null)
    }
  }
}

module "project_services" {
  source     = "./modules/project_services"
  project_id = var.project_id
  services   = var.apis
}

resource "google_service_account" "ci" {
  count        = var.create_ci_service_account ? 1 : 0
  account_id   = var.ci_service_account_name
  display_name = var.ci_service_account_display_name
  project      = var.project_id
}

resource "google_project_iam_member" "ci_roles" {
  for_each = var.create_ci_service_account ? toset(var.ci_service_account_roles) : toset([])

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.ci[0].email}"
}

module "static_sites" {
  source   = "./modules/static_site"
  for_each = local.normalized_environments

  project_id          = var.project_id
  name                = each.value.app_id
  domain              = each.value.domain
  dns_zone_name       = each.value.dns_zone_name
  dns_project_id      = each.value.dns_project_id
  bucket_location     = each.value.bucket_location
  bucket_name         = each.value.bucket_name
  force_destroy       = each.value.force_destroy
  labels              = each.value.labels
  certificate_domains = each.value.certificate_domains
  create_dns_record   = each.value.create_dns_record
  enable_cdn          = each.value.enable_cdn
}

module "env_secrets" {
  source = "./modules/env_secret"
  for_each = {
    for name, cfg in local.normalized_environments :
    name => cfg if cfg.env_file_path != null
  }

  project_id           = var.project_id
  name                 = "${each.value.app_id}-env"
  env_file_path        = each.value.env_file_path
  replication_location = each.value.secret_replication_location
  labels               = each.value.labels
}
