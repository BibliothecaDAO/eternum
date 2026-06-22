output "aws_region" {
  value = var.aws_region
}

output "aws_role_to_assume" {
  value = aws_iam_role.github_runtime_deployer.arn
}

output "aws_runtime_cluster" {
  value = aws_ecs_cluster.runtime.name
}

output "aws_runtime_domain" {
  value = var.domain_name
}

output "aws_runtime_ecr_repository_url" {
  value = aws_ecr_repository.runtime.repository_url
}

output "aws_runtime_task_execution_role_arn" {
  value = aws_iam_role.task_execution.arn
}

output "aws_runtime_task_role_arn" {
  value = aws_iam_role.task.arn
}

output "aws_runtime_subnet_ids" {
  value = join(",", aws_subnet.private[*].id)
}

output "aws_runtime_security_group_ids" {
  value = aws_security_group.runtime_tasks.id
}

output "aws_runtime_efs_file_system_id" {
  value = aws_efs_file_system.runtime.id
}

output "aws_runtime_vpc_id" {
  value = aws_vpc.runtime.id
}

output "aws_runtime_alb_listener_arn" {
  value = aws_lb_listener.https.arn
}

output "aws_runtime_log_group" {
  value = aws_cloudwatch_log_group.runtime.name
}
