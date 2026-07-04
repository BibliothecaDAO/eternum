data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

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
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [for environment in var.github_environments : "repo:${var.github_org}/${var.github_repo}:environment:${environment}"]
    }
  }
}

locals {
  availability_zone_names         = slice(data.aws_availability_zones.available.names, 0, 2)
  aws_account_id                  = data.aws_caller_identity.current.account_id
  ecs_service_arn_pattern         = "arn:aws:ecs:${var.aws_region}:${local.aws_account_id}:service/${aws_ecs_cluster.runtime.name}/*"
  ecs_task_arn_pattern            = "arn:aws:ecs:${var.aws_region}:${local.aws_account_id}:task/${aws_ecs_cluster.runtime.name}/*"
  ecs_task_definition_arn_pattern = "arn:aws:ecs:${var.aws_region}:${local.aws_account_id}:task-definition/*"
  efs_access_point_arn_pattern    = "arn:aws:elasticfilesystem:${var.aws_region}:${local.aws_account_id}:access-point/*"
  elb_listener_rule_arn_pattern   = "arn:aws:elasticloadbalancing:${var.aws_region}:${local.aws_account_id}:listener-rule/app/${var.project_name}/*/*"
  elb_target_group_arn_pattern    = "arn:aws:elasticloadbalancing:${var.aws_region}:${local.aws_account_id}:targetgroup/*/*"
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
    to_port         = 5050
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port       = 8080
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

resource "aws_security_group" "vpc_endpoints" {
  count       = var.enable_vpc_endpoints ? 1 : 0
  name        = "${var.project_name}-vpc-endpoints"
  description = "Private AWS API endpoint ingress from runtime tasks"
  vpc_id      = aws_vpc.runtime.id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.runtime_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_vpc_endpoint" "s3" {
  count             = var.enable_vpc_endpoints ? 1 : 0
  vpc_id            = aws_vpc.runtime.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = merge(local.tags, {
    Name = "${var.project_name}-s3"
  })
}

resource "aws_vpc_endpoint" "interface" {
  for_each = var.enable_vpc_endpoints ? toset(["ecr.api", "ecr.dkr", "logs"]) : toset([])

  vpc_id              = aws_vpc.runtime.id
  service_name        = "com.amazonaws.${var.aws_region}.${each.key}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = merge(local.tags, {
    Name = "${var.project_name}-${replace(each.key, ".", "-")}"
  })
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

resource "aws_s3_bucket" "alb_access_logs" {
  bucket_prefix = "${var.project_name}-alb-logs-"

  tags = merge(local.tags, {
    Name = "${var.project_name}-alb-logs"
  })
}

resource "aws_s3_bucket_public_access_block" "alb_access_logs" {
  bucket                  = aws_s3_bucket.alb_access_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_access_logs" {
  bucket = aws_s3_bucket.alb_access_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_access_logs" {
  bucket = aws_s3_bucket.alb_access_logs.id

  rule {
    id     = "expire-alb-access-logs"
    status = "Enabled"

    filter {
      prefix = "alb/"
    }

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_policy" "alb_access_logs" {
  bucket = aws_s3_bucket.alb_access_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowAlbLogDelivery"
        Effect = "Allow"
        Principal = {
          Service = "logdelivery.elasticloadbalancing.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_access_logs.arn}/alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      }
    ]
  })
}

resource "aws_lb" "runtime" {
  name                       = var.project_name
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  idle_timeout               = 3600
  enable_deletion_protection = true

  access_logs {
    bucket  = aws_s3_bucket.alb_access_logs.bucket
    prefix  = "alb"
    enabled = true
  }

  depends_on = [aws_s3_bucket_policy.alb_access_logs]

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
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

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

resource "aws_ecr_lifecycle_policy" "runtime" {
  repository = aws_ecr_repository.runtime.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged runtime images after 14 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep the most recent tagged runtime images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 20
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_sns_topic" "runtime_alerts" {
  name = "${var.project_name}-alerts"

  tags = local.tags
}

resource "aws_sns_topic_subscription" "runtime_alert_emails" {
  for_each  = toset(var.alert_email_addresses)
  topic_arn = aws_sns_topic.runtime_alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_sns_topic_subscription" "runtime_alert_webhook" {
  count     = var.alert_webhook_url == null || var.alert_webhook_url == "" ? 0 : 1
  topic_arn = aws_sns_topic.runtime_alerts.arn
  protocol  = "https"
  endpoint  = var.alert_webhook_url
}

resource "aws_sns_topic_policy" "runtime_alerts_events" {
  arn = aws_sns_topic.runtime_alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgeRuntimeAlerts"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.runtime_alerts.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.ecs_task_stopped.arn
          }
        }
      }
    ]
  })
}

resource "aws_cloudwatch_event_rule" "ecs_task_stopped" {
  name        = "${var.project_name}-ecs-task-stopped"
  description = "Notify when runtime ECS tasks stop so operators can inspect restart storms."

  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      clusterArn = [aws_ecs_cluster.runtime.arn]
      lastStatus = ["STOPPED"]
    }
  })

  tags = local.tags
}

resource "aws_cloudwatch_event_target" "ecs_task_stopped_alerts" {
  rule      = aws_cloudwatch_event_rule.ecs_task_stopped.name
  target_id = "runtime-alerts"
  arn       = aws_sns_topic.runtime_alerts.arn
}

resource "aws_cloudwatch_metric_alarm" "alb_elb_5xx" {
  alarm_name          = "${var.project_name}-alb-elb-5xx"
  alarm_description   = "ALB generated 5xx responses for the runtime foundation."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.runtime_alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.runtime.arn_suffix
  }

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "nat_error_port_allocation" {
  alarm_name          = "${var.project_name}-nat-error-port-allocation"
  alarm_description   = "NAT gateway port allocation errors can break private runtime egress."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ErrorPortAllocation"
  namespace           = "AWS/NATGateway"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.runtime_alerts.arn]

  dimensions = {
    NatGatewayId = aws_nat_gateway.runtime.id
  }

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "efs_percent_io_limit" {
  alarm_name          = "${var.project_name}-efs-percent-io-limit"
  alarm_description   = "EFS IO limit pressure can slow runtime snapshot restore and backup operations."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 5
  metric_name         = "PercentIOLimit"
  namespace           = "AWS/EFS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.runtime_alerts.arn]

  dimensions = {
    FileSystemId = aws_efs_file_system.runtime.id
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
      },
      {
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
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

  # Deployer grant mapping:
  # - EcrRuntimeImages: preflight requested runtime image tags before task definition registration.
  # - EcrImagePublishing: build and push linux/amd64 runtime images from GitHub Actions.
  # - EcrAuthorization: request the ECR authorization token required before image publishing.
  # - EcsRuntimeLifecycle: create/update/delete/tag ECS services scoped to the runtime cluster service ARN pattern.
  # - EcsTaskDefinitions: describe/register task definitions; ECS task-definition IAM policies require Resource="*".
  # - EcsCleanupTasks: run and verify one-off snapshot cleanup tasks scoped to runtime task/task-definition ARN patterns.
  # - ElbRuntimeCreation: create target groups/listener rules; create-time ELB APIs require Resource="*" and are tag-scoped.
  # - ElbRuntimeLifecycle: delete/list/tag target groups and listener rules scoped to runtime ALB ARN patterns.
  # - EfsAccessPointCreation: create runtime snapshot access points on the runtime file system with required project tags.
  # - EfsAccessPointLifecycle: find/tag/delete runtime snapshot access points scoped to the runtime file system/AP patterns.
  # - RuntimeAlarms: create and delete per-runtime health alarms with SNS actions.
  # - RuntimeLogs: inspect runtime restore markers from CloudWatch Logs for deployment artifacts.
  # - RuntimeResourceAudit: verify delete left no runtime-tagged AWS resources.
  # - PassRuntimeRoles: pass only the runtime task roles to ECS tasks.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EcrRuntimeImages"
        Effect = "Allow"
        Action = [
          "ecr:DescribeImages"
        ]
        Resource = aws_ecr_repository.runtime.arn
      },
      {
        Sid    = "EcrImagePublishing"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
        Resource = aws_ecr_repository.runtime.arn
      },
      {
        Sid    = "EcrAuthorization"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "EcsRuntimeLifecycle"
        Effect = "Allow"
        Action = [
          "ecs:CreateService",
          "ecs:DeleteService",
          "ecs:DescribeServices",
          "ecs:ListTagsForResource",
          "ecs:TagResource",
          "ecs:UpdateService"
        ]
        Resource = local.ecs_service_arn_pattern
      },
      {
        Sid    = "EcsTaskDefinitions"
        Effect = "Allow"
        Action = [
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition"
        ]
        Resource = "*"
      },
      {
        Sid    = "EcsCleanupTasks"
        Effect = "Allow"
        Action = [
          "ecs:DescribeTasks",
          "ecs:RunTask"
        ]
        Resource = [
          local.ecs_task_arn_pattern,
          local.ecs_task_definition_arn_pattern
        ]
      },
      {
        Sid    = "ElbRuntimeCreation"
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:CreateRule",
          "elasticloadbalancing:CreateTargetGroup"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestTag/Project" = local.tags.Project
          }
        }
      },
      {
        Sid    = "ElbRuntimeLifecycle"
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:DeleteRule",
          "elasticloadbalancing:DeleteTargetGroup",
          "elasticloadbalancing:ModifyRule",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeTags",
          "elasticloadbalancing:AddTags"
        ]
        Resource = [
          aws_lb_listener.https.arn,
          local.elb_listener_rule_arn_pattern,
          local.elb_target_group_arn_pattern
        ]
      },
      {
        Sid    = "EfsAccessPointCreation"
        Effect = "Allow"
        Action = [
          "elasticfilesystem:CreateAccessPoint"
        ]
        Resource = aws_efs_file_system.runtime.arn
        Condition = {
          StringEquals = {
            "aws:RequestTag/Project" = local.tags.Project
          }
        }
      },
      {
        Sid    = "EfsAccessPointLifecycle"
        Effect = "Allow"
        Action = [
          "elasticfilesystem:DeleteAccessPoint",
          "elasticfilesystem:DescribeAccessPoints",
          "elasticfilesystem:TagResource"
        ]
        Resource = [
          aws_efs_file_system.runtime.arn,
          local.efs_access_point_arn_pattern
        ]
      },
      {
        Sid    = "RuntimeAlarms"
        Effect = "Allow"
        Action = [
          "cloudwatch:DeleteAlarms",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:PutMetricAlarm"
        ]
        Resource = "arn:aws:cloudwatch:${var.aws_region}:*:alarm:${var.project_name}-*"
      },
      {
        Sid    = "RuntimeLogs"
        Effect = "Allow"
        Action = [
          "logs:FilterLogEvents"
        ]
        Resource = [
          aws_cloudwatch_log_group.runtime.arn,
          "${aws_cloudwatch_log_group.runtime.arn}:*"
        ]
      },
      {
        Sid    = "RuntimeResourceAudit"
        Effect = "Allow"
        Action = [
          "tag:GetResources"
        ]
        Resource = "*"
      },
      {
        Sid    = "PassRuntimeRoles"
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          aws_iam_role.task_execution.arn,
          aws_iam_role.task.arn
        ]
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      }
    ]
  })
}
