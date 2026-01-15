resource "google_project_service" "this" {
  for_each = toset(var.services)

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}
