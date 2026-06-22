data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_iam_policy_document" "github_oidc_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:environment:${var.github_environment}"]
    }
  }
}

locals {
  availability_zone_names = slice(data.aws_availability_zones.available.names, 0, 2)
  tags = {
    Project = "eternum"
    Service = "game-runtime"
  }
}

resource "aws_vpc" "runtime" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name = var.project_name
  })
}

resource "aws_internet_gateway" "runtime" {
  vpc_id = aws_vpc.runtime.id

  tags = merge(local.tags, {
    Name = var.project_name
  })
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.runtime.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.availability_zone_names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name = "${var.project_name}-public-${count.index + 1}"
  })
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.runtime.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = local.availability_zone_names[count.index]

  tags = merge(local.tags, {
    Name = "${var.project_name}-private-${count.index + 1}"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.runtime.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.runtime.id
  }

  tags = merge(local.tags, {
    Name = "${var.project_name}-public"
  })
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(local.tags, {
    Name = "${var.project_name}-nat"
  })
}

resource "aws_nat_gateway" "runtime" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = merge(local.tags, {
    Name = var.project_name
  })
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.runtime.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.runtime.id
  }

  tags = merge(local.tags, {
    Name = "${var.project_name}-private"
  })
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb"
  description = "Public ALB for game runtimes"
  vpc_id      = aws_vpc.runtime.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_security_group" "runtime_tasks" {
  name        = "${var.project_name}-tasks"
  description = "Runtime task ingress from the ALB"
  vpc_id      = aws_vpc.runtime.id

  ingress {
    from_port       = 5050
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_security_group" "efs" {
  name        = "${var.project_name}-efs"
  description = "Runtime EFS mount access"
  vpc_id      = aws_vpc.runtime.id

  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.runtime_tasks.id]
  }

  tags = local.tags
}

resource "aws_acm_certificate" "runtime" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.tags
}

resource "aws_route53_record" "certificate_validation" {
  for_each = {
    for option in aws_acm_certificate.runtime.domain_validation_options : option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  }

  zone_id = var.hosted_zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "runtime" {
  certificate_arn         = aws_acm_certificate.runtime.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

resource "aws_lb" "runtime" {
  name               = var.project_name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.runtime.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.runtime.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate_validation.runtime.certificate_arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "application/json"
      message_body = "{\"error\":\"runtime route not found\"}"
      status_code  = "404"
    }
  }
}

resource "aws_route53_record" "runtime" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.runtime.dns_name
    zone_id                = aws_lb.runtime.zone_id
    evaluate_target_health = true
  }
}

resource "aws_ecs_cluster" "runtime" {
  name = var.project_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.tags
}

resource "aws_ecr_repository" "runtime" {
  name                 = var.project_name
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_cloudwatch_log_group" "runtime" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = 30

  tags = local.tags
}

resource "aws_efs_file_system" "runtime" {
  encrypted        = true
  performance_mode = "generalPurpose"
  throughput_mode  = "elastic"

  tags = merge(local.tags, {
    Name = var.project_name
  })
}

resource "aws_efs_mount_target" "runtime" {
  count           = length(aws_subnet.private)
  file_system_id  = aws_efs_file_system.runtime.id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.efs.id]
}

resource "aws_efs_backup_policy" "runtime" {
  file_system_id = aws_efs_file_system.runtime.id

  backup_policy {
    status = "ENABLED"
  }
}

resource "aws_backup_vault" "runtime" {
  name = var.project_name

  tags = local.tags
}

resource "aws_backup_plan" "runtime" {
  name = var.project_name

  rule {
    rule_name         = "daily"
    target_vault_name = aws_backup_vault.runtime.name
    schedule          = "cron(0 5 * * ? *)"

    lifecycle {
      delete_after = 35
    }
  }

  tags = local.tags
}

resource "aws_iam_role" "backup" {
  name = "${var.project_name}-backup"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "backup.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_backup_selection" "runtime" {
  iam_role_arn = aws_iam_role.backup.arn
  name         = var.project_name
  plan_id      = aws_backup_plan.runtime.id
  resources    = [aws_efs_file_system.runtime.arn]
}

resource "aws_iam_role" "task_execution" {
  name = "${var.project_name}-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name = "${var.project_name}-task"

  assume_role_policy = aws_iam_role.task_execution.assume_role_policy

  tags = local.tags
}

resource "aws_iam_role_policy" "task" {
  name = "${var.project_name}-task"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite",
          "elasticfilesystem:ClientRootAccess"
        ]
        Resource = aws_efs_file_system.runtime.arn
      }
    ]
  })
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = local.tags
}

resource "aws_iam_role" "github_runtime_deployer" {
  name               = "${var.project_name}-github-deployer"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume_role.json

  tags = local.tags
}

resource "aws_iam_role_policy" "github_runtime_deployer" {
  name = "${var.project_name}-github-deployer"
  role = aws_iam_role.github_runtime_deployer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:CreateService",
          "ecs:DeleteService",
          "ecs:DescribeServices",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
          "ecs:TagResource",
          "ecs:ListTagsForResource",
          "elasticloadbalancing:CreateRule",
          "elasticloadbalancing:CreateTargetGroup",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:AddTags",
          "elasticfilesystem:CreateAccessPoint",
          "elasticfilesystem:DescribeAccessPoints",
          "elasticfilesystem:TagResource",
          "iam:PassRole"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_ssm_parameter" "runtime_domain" {
  name  = "/${var.project_name}/runtime-domain"
  type  = "String"
  value = var.domain_name

  tags = local.tags
}

resource "aws_secretsmanager_secret" "runtime" {
  name = "${var.project_name}/runtime"

  tags = local.tags
}
