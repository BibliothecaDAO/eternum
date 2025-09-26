output "enabled_services" {
  description = "APIs enabled on the project"
  value       = [for service in google_project_service.this : service.service]
}
