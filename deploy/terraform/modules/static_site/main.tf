locals {
  normalized_name           = regex_replace(lower(var.name), "[^a-z0-9-]", "-")
  trimmed_name              = regex_replace(regex_replace(local.normalized_name, "^-+", ""), "-+$", "")
  resource_prefix           = substr(local.trimmed_name != "" ? local.trimmed_name : "site", 0, 30)
  raw_bucket_name           = length(var.bucket_name) > 0 ? var.bucket_name : lower(join("-", compact([var.project_id, local.resource_prefix, "site"])))
  sanitized_bucket_step_one = regex_replace(lower(local.raw_bucket_name), "[^a-z0-9-]", "-")
  sanitized_bucket_step_two = regex_replace(regex_replace(local.sanitized_bucket_step_one, "^-+", ""), "-+$", "")
  bucket_name               = substr(local.sanitized_bucket_step_two != "" ? local.sanitized_bucket_step_two : "site-${var.project_id}", 0, 63)
  certificate_domains       = length(var.certificate_domains) > 0 ? var.certificate_domains : [var.domain]
  dns_project_id            = coalesce(var.dns_project_id, var.project_id)
}

resource "google_storage_bucket" "site" {
  project                     = var.project_id
  name                        = local.bucket_name
  location                    = var.bucket_location
  uniform_bucket_level_access = true
  force_destroy               = var.force_destroy
  labels                      = var.labels

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.site.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_compute_backend_bucket" "site" {
  project     = var.project_id
  name        = "site-${local.resource_prefix}-backend"
  bucket_name = google_storage_bucket.site.name
  enable_cdn  = var.enable_cdn

  dynamic "cdn_policy" {
    for_each = var.enable_cdn ? [1] : []

    content {}
  }
}

resource "google_compute_url_map" "site" {
  project         = var.project_id
  name            = "site-${local.resource_prefix}-url-map"
  default_service = google_compute_backend_bucket.site.id

  host_rule {
    hosts        = [var.domain]
    path_matcher = "allpaths"
  }

  path_matcher {
    name            = "allpaths"
    default_service = google_compute_backend_bucket.site.id
  }
}

resource "google_compute_global_address" "site" {
  project = var.project_id
  name    = "site-${local.resource_prefix}-ip"
}

resource "google_compute_managed_ssl_certificate" "site" {
  provider = google-beta
  project  = var.project_id
  name     = "site-${local.resource_prefix}-cert"

  managed {
    domains = local.certificate_domains
  }
}

resource "google_compute_target_https_proxy" "site" {
  project          = var.project_id
  name             = "site-${local.resource_prefix}-https-proxy"
  url_map          = google_compute_url_map.site.id
  ssl_certificates = [google_compute_managed_ssl_certificate.site.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  project               = var.project_id
  name                  = "site-${local.resource_prefix}-https"
  target                = google_compute_target_https_proxy.site.id
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL"
  ip_address            = google_compute_global_address.site.address
}

data "google_dns_managed_zone" "site" {
  count   = var.create_dns_record ? 1 : 0
  name    = var.dns_zone_name
  project = local.dns_project_id
}

resource "google_dns_record_set" "site" {
  count        = var.create_dns_record ? 1 : 0
  project      = local.dns_project_id
  name         = "${var.domain}."
  type         = "A"
  ttl          = 300
  managed_zone = data.google_dns_managed_zone.site[0].name
  rrdatas      = [google_compute_global_forwarding_rule.https.ip_address]
}
