data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "github_oidc_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:environment:${var.github_environment}"]
    }
  }
}

locals {
  availability_zone_names                 = slice(data.aws_availability_zones.available.names, 0, 2)
  aws_account_id                          = data.aws_caller_identity.current.account_id
  environment_segment                     = replace(var.environment_id, ".", "-")
  is_production                           = var.account_class == "production"
  is_dr                                   = var.account_class == "dr"
  nat_gateway_count                       = local.is_production ? length(var.public_subnet_cidrs) : 1
  runtime_shards                          = toset([for shard in range(var.runtime_shard_count) : tostring(shard)])
  runtime_certificate_arn                 = var.existing_certificate_arn != null ? var.existing_certificate_arn : aws_acm_certificate_validation.runtime[0].certificate_arn
  runtime_ecr_repository_name             = coalesce(var.ecr_repository_name, var.project_name)
  ecs_service_arn_pattern                 = "arn:aws:ecs:${var.aws_region}:${local.aws_account_id}:service/${aws_ecs_cluster.runtime.name}/*"
  ecs_task_arn_pattern                    = "arn:aws:ecs:${var.aws_region}:${local.aws_account_id}:task/${aws_ecs_cluster.runtime.name}/*"
  ecs_task_definition_arn_pattern         = "arn:aws:ecs:${var.aws_region}:${local.aws_account_id}:task-definition/*"
  environment_task_definition_arn_pattern = "arn:aws:ecs:${var.aws_region}:${local.aws_account_id}:task-definition/${local.environment_segment}-*"
  runtime_alarm_arn_pattern               = "arn:aws:cloudwatch:${var.aws_region}:${local.aws_account_id}:alarm:${local.environment_segment}-*"
  backup_recovery_point_arn_pattern       = "arn:aws:backup:${var.aws_region}:${local.aws_account_id}:recovery-point:*"
  efs_access_point_arn_pattern            = "arn:aws:elasticfilesystem:${var.aws_region}:${local.aws_account_id}:access-point/*"
  elb_listener_rule_arn_pattern           = "arn:aws:elasticloadbalancing:${var.aws_region}:${local.aws_account_id}:listener-rule/app/${var.project_name}-s*/*/*"
  elb_target_group_arn_pattern            = "arn:aws:elasticloadbalancing:${var.aws_region}:${local.aws_account_id}:targetgroup/*/*"
  tags = {
    Project     = "eternum"
    Service     = "game-runtime"
    Environment = var.environment_id
  }
}

resource "terraform_data" "foundation_gate" {
  lifecycle {
    precondition {
      condition     = var.github_environment == var.environment_id
      error_message = "github_environment must exactly match environment_id."
    }

    precondition {
      condition = var.github_oidc_provider_arn == format(
        "arn:aws:iam::%s:oidc-provider/token.actions.githubusercontent.com",
        local.aws_account_id
      )
      error_message = "github_oidc_provider_arn must be the GitHub provider owned by this environment's AWS account."
    }

    precondition {
      condition = !local.is_production || (
        length(var.alert_email_addresses) > 0 ||
        (var.alert_webhook_url != null && var.alert_webhook_url != "")
      )
      error_message = "Production requires at least one runtime alert destination."
    }

    precondition {
      condition     = !local.is_production || startswith(var.environment_id, "mainnet.")
      error_message = "The production account may host only mainnet environments."
    }

    precondition {
      condition     = local.is_production || local.is_dr || !startswith(var.environment_id, "mainnet.")
      error_message = "Mainnet environments must be created in the production or DR account."
    }

    precondition {
      condition     = !startswith(var.environment_id, "mainnet.") || var.waf_enforcement_mode == "block"
      error_message = "Mainnet environments require WAF enforcement mode block before deployment."
    }

    precondition {
      condition     = !local.is_production || var.backup_copy_vault_arn != null
      error_message = "Production requires a cross-account us-west-2 backup_copy_vault_arn."
    }

    precondition {
      condition     = !local.is_production || var.dr_account_id != null
      error_message = "Production requires dr_account_id for cross-account ECR replication."
    }

    precondition {
      condition     = !local.is_production || var.dr_account_id != local.aws_account_id
      error_message = "Production dr_account_id must identify a separate AWS account."
    }

    precondition {
      condition = !local.is_production || (
        try(split(":", var.backup_copy_vault_arn)[4], "") == var.dr_account_id
      )
      error_message = "Production backup_copy_vault_arn must be owned by dr_account_id."
    }

    precondition {
      condition     = !local.is_production || length(var.candidate_ecr_repository_arns) > 0
      error_message = "Production requires at least one non-production candidate ECR repository ARN."
    }

    precondition {
      condition     = !local.is_production || var.efs_replica_file_system_id != null
      error_message = "Production requires efs_replica_file_system_id from the isolated DR foundation."
    }

    precondition {
      condition     = !local.is_dr || var.production_account_id != null
      error_message = "A DR foundation requires production_account_id for its ECR registry policy."
    }

    precondition {
      condition     = !local.is_dr || var.production_account_id != local.aws_account_id
      error_message = "DR production_account_id must identify a separate AWS account."
    }

    precondition {
      condition     = !local.is_dr || startswith(var.environment_id, "mainnet.")
      error_message = "The isolated DR account may host only mainnet recovery environments."
    }

    precondition {
      condition     = !local.is_dr || (!var.manage_public_dns && var.existing_certificate_arn != null)
      error_message = "A DR foundation must use an existing regional certificate and leave public DNS to the recovery workflow."
    }
  }
}

data "aws_iam_policy_document" "runtime_kms" {
  # checkov:skip=CKV_AWS_109:KMS key policies require Resource="*" to describe permissions on the key that owns the policy.
  # checkov:skip=CKV_AWS_111:KMS key policies require Resource="*" to describe permissions on the key that owns the policy.
  # checkov:skip=CKV_AWS_356:KMS key policies require Resource="*" to describe permissions on the key that owns the policy.
  statement {
    sid    = "EnableAccountAdministration"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.aws_account_id}:root"]
    }

    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "AllowCloudWatchLogsEncryption"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["logs.${var.aws_region}.amazonaws.com"]
    }

    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*"
    ]
    resources = ["*"]

    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:aws:logs:${var.aws_region}:${local.aws_account_id}:log-group:*"]
    }
  }

  statement {
    sid    = "AllowAlertPublishers"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com", "cloudwatch.amazonaws.com", "events.amazonaws.com"]
    }

    actions   = ["kms:Decrypt", "kms:GenerateDataKey*"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["sns.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_kms_key" "runtime" {
  description             = "Environment runtime data encryption for ${var.environment_id}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.runtime_kms.json

  lifecycle {
    prevent_destroy = true
  }

  tags = local.tags
}

resource "aws_kms_alias" "runtime" {
  name          = "alias/${var.project_name}-${local.environment_segment}"
  target_key_id = aws_kms_key.runtime.key_id
}

resource "aws_vpc" "runtime" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name = var.project_name
  })
}

resource "aws_default_security_group" "runtime" {
  vpc_id = aws_vpc.runtime.id

  tags = merge(local.tags, {
    Name = "${var.project_name}-default-deny"
  })
}

resource "aws_cloudwatch_log_group" "vpc_flow" {
  name              = "/aws/vpc-flow/${var.project_name}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.runtime.arn

  tags = local.tags
}

resource "aws_iam_role" "vpc_flow_logs" {
  name = "${var.project_name}-vpc-flow-logs"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "${var.project_name}-vpc-flow-logs"
  role = aws_iam_role.vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:DescribeLogStreams",
        "logs:PutLogEvents"
      ]
      Resource = "${aws_cloudwatch_log_group.vpc_flow.arn}:*"
    }]
  })
}

resource "aws_flow_log" "runtime" {
  iam_role_arn         = aws_iam_role.vpc_flow_logs.arn
  log_destination      = aws_cloudwatch_log_group.vpc_flow.arn
  log_destination_type = "cloud-watch-logs"
  traffic_type         = "ALL"
  vpc_id               = aws_vpc.runtime.id

  tags = local.tags
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
  map_public_ip_on_launch = false

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
  count  = local.nat_gateway_count
  domain = "vpc"

  tags = merge(local.tags, {
    Name = "${var.project_name}-nat-${count.index + 1}"
  })
}

resource "aws_nat_gateway" "runtime" {
  count         = local.nat_gateway_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.tags, {
    Name = "${var.project_name}-${count.index + 1}"
  })
}

resource "aws_route_table" "private" {
  count  = length(aws_subnet.private)
  vpc_id = aws_vpc.runtime.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.runtime[local.is_production ? count.index : 0].id
  }

  tags = merge(local.tags, {
    Name = "${var.project_name}-private-${count.index + 1}"
  })
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb"
  description = "Public ALB for game runtimes"
  vpc_id      = aws_vpc.runtime.id

  tags = local.tags
}

resource "aws_security_group" "runtime_tasks" {
  name        = "${var.project_name}-tasks"
  description = "Runtime task ingress from the ALB"
  vpc_id      = aws_vpc.runtime.id

  tags = local.tags

  # checkov:skip=CKV2_AWS_5:ECS services are runtime resources created by the control plane after the foundation is applied.
}

resource "aws_security_group" "efs" {
  name        = "${var.project_name}-efs"
  description = "Runtime EFS mount access"
  vpc_id      = aws_vpc.runtime.id

  tags = local.tags
}

resource "aws_security_group" "vpc_endpoints" {
  count       = var.enable_vpc_endpoints ? 1 : 0
  name        = "${var.project_name}-vpc-endpoints"
  description = "Private AWS API endpoint ingress from runtime tasks"
  vpc_id      = aws_vpc.runtime.id

  tags = local.tags

  # checkov:skip=CKV2_AWS_5:The group is attached to interface endpoints created by this module; Checkov does not resolve the conditional count.
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "Public TLS traffic to the runtime ALB"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "alb_runtime" {
  for_each = toset(["5050", "8080"])

  security_group_id            = aws_security_group.alb.id
  description                  = "ALB traffic to runtime task port ${each.key}"
  referenced_security_group_id = aws_security_group.runtime_tasks.id
  from_port                    = tonumber(each.key)
  ip_protocol                  = "tcp"
  to_port                      = tonumber(each.key)
}

resource "aws_vpc_security_group_ingress_rule" "runtime_alb" {
  for_each = toset(["5050", "8080"])

  security_group_id            = aws_security_group.runtime_tasks.id
  description                  = "Runtime task port ${each.key} from the environment ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = tonumber(each.key)
  ip_protocol                  = "tcp"
  to_port                      = tonumber(each.key)
}

# Runtime upstream RPC hostnames vary by environment and provider, so TLS egress cannot use a stable CIDR allowlist.
#trivy:ignore:AVD-AWS-0104
resource "aws_vpc_security_group_egress_rule" "runtime_https" {
  security_group_id = aws_security_group.runtime_tasks.id
  description       = "TLS access to upstream RPC and AWS service endpoints"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "runtime_dns" {
  for_each = toset(["tcp", "udp"])

  security_group_id = aws_security_group.runtime_tasks.id
  description       = "DNS resolution through the VPC resolver over ${upper(each.key)}"
  cidr_ipv4         = "${cidrhost(var.vpc_cidr, 2)}/32"
  from_port         = 53
  ip_protocol       = each.key
  to_port           = 53
}

resource "aws_vpc_security_group_egress_rule" "runtime_efs" {
  security_group_id            = aws_security_group.runtime_tasks.id
  description                  = "NFS access to the environment EFS mount targets"
  referenced_security_group_id = aws_security_group.efs.id
  from_port                    = 2049
  ip_protocol                  = "tcp"
  to_port                      = 2049
}

resource "aws_vpc_security_group_ingress_rule" "efs_runtime" {
  security_group_id            = aws_security_group.efs.id
  description                  = "NFS mounts from environment runtime tasks"
  referenced_security_group_id = aws_security_group.runtime_tasks.id
  from_port                    = 2049
  ip_protocol                  = "tcp"
  to_port                      = 2049
}

resource "aws_vpc_security_group_ingress_rule" "vpc_endpoints_runtime" {
  count = var.enable_vpc_endpoints ? 1 : 0

  security_group_id            = aws_security_group.vpc_endpoints[0].id
  description                  = "Private AWS API access from environment runtime tasks"
  referenced_security_group_id = aws_security_group.runtime_tasks.id
  from_port                    = 443
  ip_protocol                  = "tcp"
  to_port                      = 443
}

resource "aws_vpc_endpoint" "s3" {
  count             = var.enable_vpc_endpoints ? 1 : 0
  vpc_id            = aws_vpc.runtime.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id

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
  count                     = var.existing_certificate_arn == null ? 1 : 0
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${local.environment_segment}.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.tags
}

resource "aws_route53_record" "certificate_validation" {
  for_each = var.existing_certificate_arn == null ? {
    for option in aws_acm_certificate.runtime[0].domain_validation_options : option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  } : {}

  zone_id = var.hosted_zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "runtime" {
  count                   = var.existing_certificate_arn == null ? 1 : 0
  certificate_arn         = aws_acm_certificate.runtime[0].arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

# This terminal ALB log sink cannot log to itself without creating an infinite delivery loop.
#trivy:ignore:s3-bucket-logging
resource "aws_s3_bucket" "alb_access_logs" {
  bucket_prefix = "${var.project_name}-alb-logs-"

  # checkov:skip=CKV_AWS_18:This is the terminal ALB log-delivery bucket; self-logging would recurse indefinitely.
  # checkov:skip=CKV_AWS_144:ALB request logs are operational telemetry, while runtime state and backups are replicated separately.
  # checkov:skip=CKV_AWS_145:ALB log delivery supports SSE-S3 for this destination; the runtime data stores use the environment CMK.
  # checkov:skip=CKV2_AWS_62:ALB and WAF metrics provide alerting; object-created notifications would duplicate every request-log delivery.

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

# ALB log delivery requires SSE-S3 for this destination bucket.
#trivy:ignore:AVD-AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "alb_access_logs" {
  bucket = aws_s3_bucket.alb_access_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "alb_access_logs" {
  bucket = aws_s3_bucket.alb_access_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_access_logs" {
  bucket = aws_s3_bucket.alb_access_logs.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

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
      },
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.alb_access_logs.arn,
          "${aws_s3_bucket.alb_access_logs.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Public runtime reads terminate at this TLS-only ALB and are protected by the associated WAF.
#trivy:ignore:AVD-AWS-0053
resource "aws_lb" "runtime" {
  for_each                   = local.runtime_shards
  name                       = "${substr(var.project_name, 0, 28)}-s${each.key}"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  idle_timeout               = 3600
  enable_deletion_protection = true
  drop_invalid_header_fields = true

  access_logs {
    bucket  = aws_s3_bucket.alb_access_logs.bucket
    prefix  = "alb"
    enabled = true
  }

  depends_on = [aws_s3_bucket_policy.alb_access_logs]

  tags = local.tags
}

resource "aws_lb_listener" "https" {
  for_each          = local.runtime_shards
  load_balancer_arn = aws_lb.runtime[each.key].arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = local.runtime_certificate_arn
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
  for_each = var.manage_public_dns ? local.runtime_shards : toset([])
  zone_id  = var.hosted_zone_id
  name     = "s${each.key}.${local.environment_segment}.${var.domain_name}"
  type     = "A"

  alias {
    name                   = aws_lb.runtime[each.key].dns_name
    zone_id                = aws_lb.runtime[each.key].zone_id
    evaluate_target_health = true
  }
}

resource "aws_wafv2_web_acl" "runtime" {
  name  = "${var.project_name}-${local.environment_segment}"
  scope = "REGIONAL"

  # checkov:skip=CKV_AWS_192:AWSManagedRulesKnownBadInputsRuleSet is attached below; Checkov does not resolve the dynamic count/block override.

  default_action {
    allow {}
  }

  rule {
    name     = "aws-common-rule-set"
    priority = 10

    override_action {
      dynamic "count" {
        for_each = var.waf_enforcement_mode == "count" ? [1] : []
        content {}
      }
      dynamic "none" {
        for_each = var.waf_enforcement_mode == "block" ? [1] : []
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.environment_segment}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-known-bad-inputs"
    priority = 20

    override_action {
      dynamic "count" {
        for_each = var.waf_enforcement_mode == "count" ? [1] : []
        content {}
      }
      dynamic "none" {
        for_each = var.waf_enforcement_mode == "block" ? [1] : []
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.environment_segment}-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-anonymous-ip-list"
    priority = 25

    override_action {
      dynamic "count" {
        for_each = var.waf_enforcement_mode == "count" ? [1] : []
        content {}
      }
      dynamic "none" {
        for_each = var.waf_enforcement_mode == "block" ? [1] : []
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAnonymousIpList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.environment_segment}-anonymous-ip-list"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = {
      rpc     = { priority = 40, limit = 2000, path = "/rpc/" }
      sql     = { priority = 41, limit = 1000, path = "/sql" }
      graphql = { priority = 42, limit = 1000, path = "/graphql" }
    }

    content {
      name     = "runtime-${rule.key}-rate-limit"
      priority = rule.value.priority

      action {
        dynamic "count" {
          for_each = var.waf_enforcement_mode == "count" ? [1] : []
          content {}
        }
        dynamic "block" {
          for_each = var.waf_enforcement_mode == "block" ? [1] : []
          content {}
        }
      }

      statement {
        rate_based_statement {
          aggregate_key_type = "IP"
          limit              = rule.value.limit

          scope_down_statement {
            byte_match_statement {
              positional_constraint = "CONTAINS"
              search_string         = rule.value.path

              field_to_match {
                uri_path {}
              }

              text_transformation {
                priority = 0
                type     = "NONE"
              }
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${local.environment_segment}-runtime-${rule.key}-rate-limit"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.environment_segment}-runtime-web-acl"
    sampled_requests_enabled   = true
  }

  tags = local.tags
}

resource "aws_wafv2_web_acl_association" "runtime" {
  for_each     = local.runtime_shards
  resource_arn = aws_lb.runtime[each.key].arn
  web_acl_arn  = aws_wafv2_web_acl.runtime.arn
}

resource "aws_cloudwatch_log_group" "waf" {
  name              = "aws-waf-logs-${var.project_name}-${local.environment_segment}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.runtime.arn

  tags = local.tags
}

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/ecs-exec/${var.project_name}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.runtime.arn

  tags = local.tags
}

resource "aws_wafv2_web_acl_logging_configuration" "runtime" {
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
  resource_arn            = aws_wafv2_web_acl.runtime.arn
}

resource "aws_ecs_cluster" "runtime" {
  name = var.project_name

  configuration {
    execute_command_configuration {
      kms_key_id = aws_kms_key.runtime.arn
      logging    = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.tags
}

resource "aws_ecr_repository" "runtime" {
  name                 = local.runtime_ecr_repository_name
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.runtime.arn
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

resource "aws_ecr_repository_policy" "runtime_candidate_pull" {
  count      = length(var.image_pull_principal_arns) > 0 ? 1 : 0
  repository = aws_ecr_repository.runtime.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowApprovedProductionImageRoles"
      Effect = "Allow"
      Principal = {
        AWS = var.image_pull_principal_arns
      }
      Action = [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:DescribeImageScanFindings",
        "ecr:DescribeImages",
        "ecr:GetDownloadUrlForLayer"
      ]
    }]
  })
}

resource "aws_dynamodb_table" "runtime_control" {
  name         = "${var.project_name}-${local.environment_segment}-control"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ControlKey"

  attribute {
    name = "ControlKey"
    type = "S"
  }

  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.runtime.arn
  }

  deletion_protection_enabled = true
  tags                        = local.tags
}

resource "aws_secretsmanager_secret" "upstream_rpc" {
  count                   = var.upstream_rpc_secret_name == null ? 0 : 1
  name                    = var.upstream_rpc_secret_name
  description             = "Sensitive upstream RPC endpoint for ${var.environment_id}; value is managed out of band."
  recovery_window_in_days = local.is_production ? 30 : 7
  kms_key_id              = aws_kms_key.runtime.arn

  # checkov:skip=CKV2_AWS_57:The upstream provider owns credential rotation; operators update the secret value out of band without a Lambda rotator.

  tags = local.tags
}

resource "aws_ssm_parameter" "foundation_manifest" {
  name        = "/eternum/runtime/${local.environment_segment}/foundation"
  description = "Non-secret machine-readable runtime foundation manifest."
  type        = "SecureString"
  key_id      = aws_kms_key.runtime.arn
  value = jsonencode({
    schemaVersion        = 1
    environmentId        = var.environment_id
    accountClass         = var.account_class
    region               = var.aws_region
    cluster              = aws_ecs_cluster.runtime.name
    routeHosts           = [for shard in range(var.runtime_shard_count) : "s${shard}.${local.environment_segment}.${var.domain_name}"]
    listenerArns         = [for shard in range(var.runtime_shard_count) : aws_lb_listener.https[tostring(shard)].arn]
    efsFileSystemId      = aws_efs_file_system.runtime.id
    runtimeControlTable  = aws_dynamodb_table.runtime_control.name
    ecrRepositoryUrl     = aws_ecr_repository.runtime.repository_url
    upstreamRpcSecretArn = try(aws_secretsmanager_secret.upstream_rpc[0].arn, null)
  })

  tags = local.tags
}

resource "aws_sns_topic" "runtime_alerts" {
  name              = "${var.project_name}-alerts"
  kms_master_key_id = aws_kms_key.runtime.arn

  tags = local.tags
}

data "aws_iam_policy_document" "runtime_alerts" {
  statement {
    sid    = "AllowAccountAdministration"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.aws_account_id}:root"]
    }

    actions   = ["SNS:*"]
    resources = [aws_sns_topic.runtime_alerts.arn]
  }

  statement {
    sid    = "AllowEnvironmentAlertPublishers"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com", "cloudwatch.amazonaws.com"]
    }

    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.runtime_alerts.arn]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.aws_account_id]
    }
  }

  statement {
    sid    = "AllowEventBridgeRuntimeAlerts"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.runtime_alerts.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values = [
        aws_cloudwatch_event_rule.ecs_task_stopped.arn,
        aws_cloudwatch_event_rule.backup_job_failed.arn,
        aws_cloudwatch_event_rule.backup_copy_failed.arn,
        aws_cloudwatch_event_rule.backup_restore_failed.arn
      ]
    }
  }
}

resource "aws_sns_topic_policy" "runtime_alerts" {
  arn    = aws_sns_topic.runtime_alerts.arn
  policy = data.aws_iam_policy_document.runtime_alerts.json
}

resource "aws_budgets_budget" "runtime" {
  name         = "${var.project_name}-${local.environment_segment}"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  depends_on = [aws_sns_topic_policy.runtime_alerts]

  cost_filter {
    name   = "TagKeyValue"
    values = [format("user:Environment$%s", var.environment_id)]
  }

  dynamic "notification" {
    for_each = toset([50, 80, 100, 120])
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value < 100 ? "FORECASTED" : "ACTUAL"
      subscriber_email_addresses = var.budget_notification_email_addresses
      subscriber_sns_topic_arns  = [aws_sns_topic.runtime_alerts.arn]
    }
  }
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

resource "aws_cloudwatch_event_rule" "ecs_task_stopped" {
  name        = "${var.project_name}-ecs-task-stopped"
  description = "Notify when runtime ECS tasks stop because an essential container exited or failed to start."

  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      clusterArn = [aws_ecs_cluster.runtime.arn]
      lastStatus = ["STOPPED"]
      stopCode   = ["EssentialContainerExited", "TaskFailedToStart"]
    }
  })

  tags = local.tags
}

resource "aws_cloudwatch_event_rule" "backup_job_failed" {
  name        = "${var.project_name}-backup-job-failed"
  description = "Notify when an environment backup job fails."

  event_pattern = jsonencode({
    source      = ["aws.backup"]
    detail-type = ["Backup Job State Change"]
    detail = {
      state = ["ABORTED", "EXPIRED", "FAILED"]
    }
  })

  tags = local.tags
}

resource "aws_cloudwatch_event_rule" "backup_copy_failed" {
  name        = "${var.project_name}-backup-copy-failed"
  description = "Notify when a cross-account recovery point copy fails."

  event_pattern = jsonencode({
    source      = ["aws.backup"]
    detail-type = ["Copy Job State Change"]
    detail = {
      state = ["FAILED"]
    }
  })

  tags = local.tags
}

resource "aws_cloudwatch_event_rule" "backup_restore_failed" {
  name        = "${var.project_name}-backup-restore-failed"
  description = "Notify when an environment restore job fails."

  event_pattern = jsonencode({
    source      = ["aws.backup"]
    detail-type = ["Restore Job State Change"]
    detail = {
      status = ["FAILED"]
    }
  })

  tags = local.tags
}

resource "aws_cloudwatch_event_target" "ecs_task_stopped_alerts" {
  rule      = aws_cloudwatch_event_rule.ecs_task_stopped.name
  target_id = "runtime-alerts"
  arn       = aws_sns_topic.runtime_alerts.arn

  depends_on = [aws_sns_topic_policy.runtime_alerts]
}

resource "aws_cloudwatch_event_target" "backup_failure_alerts" {
  for_each = {
    backup  = aws_cloudwatch_event_rule.backup_job_failed.name
    copy    = aws_cloudwatch_event_rule.backup_copy_failed.name
    restore = aws_cloudwatch_event_rule.backup_restore_failed.name
  }

  rule      = each.value
  target_id = "runtime-alerts"
  arn       = aws_sns_topic.runtime_alerts.arn

  depends_on = [aws_sns_topic_policy.runtime_alerts]
}

resource "aws_cloudwatch_metric_alarm" "alb_elb_5xx" {
  for_each            = local.runtime_shards
  alarm_name          = "${var.project_name}-s${each.key}-alb-elb-5xx"
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
    LoadBalancer = aws_lb.runtime[each.key].arn_suffix
  }

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_abnormal_restart_rate" {
  alarm_name          = "${var.project_name}-ecs-abnormal-restart-rate"
  alarm_description   = "Three or more runtime task failures were observed within five minutes."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "MatchedEvents"
  namespace           = "AWS/Events"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.runtime_alerts.arn]

  dimensions = {
    RuleName = aws_cloudwatch_event_rule.ecs_task_stopped.name
  }

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "routing_shard_capacity" {
  for_each            = local.runtime_shards
  alarm_name          = "${var.project_name}-s${each.key}-routing-capacity"
  alarm_description   = "Runtime shard admission has reached the 70-runtime warning threshold."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "RoutingShardRuntimeCount"
  namespace           = "Eternum/AwsRuntime"
  period              = 300
  statistic           = "Maximum"
  threshold           = 70
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.runtime_alerts.arn]

  dimensions = {
    EnvironmentId = var.environment_id
    RoutingShard  = each.key
  }

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "nat_error_port_allocation" {
  for_each            = { for index, gateway in aws_nat_gateway.runtime : tostring(index) => gateway }
  alarm_name          = "${var.project_name}-nat-${each.key}-error-port-allocation"
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
    NatGatewayId = each.value.id
  }

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_target_latency" {
  for_each            = local.runtime_shards
  alarm_name          = "${var.project_name}-s${each.key}-target-latency"
  alarm_description   = "Runtime target p95 latency exceeded five seconds."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p95"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.runtime_alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.runtime[each.key].arn_suffix
  }

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "waf_blocks" {
  alarm_name          = "${var.project_name}-waf-blocks"
  alarm_description   = "WAF is matching runtime requests; inspect sampled requests for abuse or false positives."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = var.waf_enforcement_mode == "count" ? "CountedRequests" : "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.runtime_alerts.arn]

  dimensions = {
    WebACL = aws_wafv2_web_acl.runtime.name
    Region = var.aws_region
    Rule   = "ALL"
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

resource "aws_cloudwatch_metric_alarm" "efs_replication_lag" {
  count               = local.is_production ? 1 : 0
  alarm_name          = "${var.project_name}-efs-replication-lag"
  alarm_description   = "Cross-account EFS replication has exceeded the 20-minute regional RPO."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TimeSinceLastSync"
  namespace           = "AWS/EFS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 1200
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.runtime_alerts.arn]

  dimensions = {
    FileSystemId            = aws_efs_file_system.runtime.id
    DestinationFileSystemId = var.efs_replica_file_system_id
  }

  tags = local.tags
}

resource "aws_cloudwatch_log_group" "runtime" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.runtime.arn

  tags = local.tags
}

resource "aws_efs_file_system" "runtime" {
  encrypted        = true
  kms_key_id       = aws_kms_key.runtime.arn
  performance_mode = "generalPurpose"
  throughput_mode  = "elastic"

  tags = merge(local.tags, {
    Name = var.project_name
  })

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_efs_file_system_policy" "runtime" {
  file_system_id                     = aws_efs_file_system.runtime.id
  bypass_policy_lockout_safety_check = false
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "AllowEnvironmentTaskAccessPoints"
          Effect = "Allow"
          Principal = {
            AWS = aws_iam_role.task.arn
          }
          Action = [
            "elasticfilesystem:ClientMount",
            "elasticfilesystem:ClientWrite"
          ]
          Resource = aws_efs_file_system.runtime.arn
          Condition = {
            StringLike = {
              "elasticfilesystem:AccessPointArn" = local.efs_access_point_arn_pattern
            }
          }
        }
      ],
      local.is_production ? [
        {
          Sid    = "AllowDrAccountToDeleteReplication"
          Effect = "Allow"
          Principal = {
            AWS = "arn:aws:iam::${var.dr_account_id}:root"
          }
          Action   = ["elasticfilesystem:DeleteReplicationConfiguration"]
          Resource = aws_efs_file_system.runtime.arn
        }
      ] : [],
      local.is_dr ? [
        {
          Sid    = "AllowProductionAccountReplication"
          Effect = "Allow"
          Principal = {
            AWS = "arn:aws:iam::${var.production_account_id}:root"
          }
          Action = [
            "elasticfilesystem:CreateReplicationConfiguration",
            "elasticfilesystem:DeleteReplicationConfiguration",
            "elasticfilesystem:DescribeFileSystems",
            "elasticfilesystem:DescribeReplicationConfigurations",
            "elasticfilesystem:ReplicationWrite"
          ]
          Resource = aws_efs_file_system.runtime.arn
        }
      ] : []
    )
  })
}

resource "aws_iam_role" "efs_replication" {
  count = local.is_production ? 1 : 0
  name  = "${var.project_name}-efs-replication"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "elasticfilesystem.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "efs_replication" {
  count = local.is_production ? 1 : 0
  name  = "${var.project_name}-efs-replication"
  role  = aws_iam_role.efs_replication[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadSourceEnvironmentFileSystem"
        Effect = "Allow"
        Action = [
          "elasticfilesystem:DescribeFileSystems",
          "elasticfilesystem:ReplicationRead"
        ]
        Resource = aws_efs_file_system.runtime.arn
      },
      {
        Sid    = "WriteDestinationEnvironmentFileSystem"
        Effect = "Allow"
        Action = [
          "elasticfilesystem:CreateReplicationConfiguration",
          "elasticfilesystem:DeleteReplicationConfiguration",
          "elasticfilesystem:DescribeFileSystems",
          "elasticfilesystem:DescribeReplicationConfigurations",
          "elasticfilesystem:ReplicationWrite"
        ]
        Resource = "arn:aws:elasticfilesystem:us-west-2:${var.dr_account_id}:file-system/${var.efs_replica_file_system_id}"
      }
    ]
  })
}

resource "aws_efs_mount_target" "runtime" {
  count           = length(aws_subnet.private)
  file_system_id  = aws_efs_file_system.runtime.id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.efs.id]
}

resource "aws_backup_vault" "runtime" {
  name        = var.project_name
  kms_key_arn = coalesce(var.backup_kms_key_arn, aws_kms_key.runtime.arn)

  tags = local.tags
}

resource "aws_backup_vault_policy" "runtime_cross_account_copy" {
  count             = local.is_dr ? 1 : 0
  backup_vault_name = aws_backup_vault.runtime.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowProductionRecoveryPointCopies"
      Effect = "Allow"
      Principal = {
        AWS = "arn:aws:iam::${var.production_account_id}:root"
      }
      Action   = ["backup:CopyIntoBackupVault"]
      Resource = aws_backup_vault.runtime.arn
    }]
  })
}

resource "aws_backup_vault_lock_configuration" "runtime" {
  backup_vault_name   = aws_backup_vault.runtime.name
  changeable_for_days = 3
  min_retention_days  = 35
  max_retention_days  = 365
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

    dynamic "copy_action" {
      for_each = local.is_production ? [var.backup_copy_vault_arn] : []
      content {
        destination_vault_arn = copy_action.value

        lifecycle {
          delete_after = 35
        }
      }
    }
  }

  rule {
    rule_name         = "weekly"
    target_vault_name = aws_backup_vault.runtime.name
    schedule          = "cron(0 6 ? * SUN *)"

    lifecycle {
      delete_after = 91
    }

    dynamic "copy_action" {
      for_each = local.is_production ? [var.backup_copy_vault_arn] : []
      content {
        destination_vault_arn = copy_action.value

        lifecycle {
          delete_after = 91
        }
      }
    }
  }

  rule {
    rule_name         = "monthly"
    target_vault_name = aws_backup_vault.runtime.name
    schedule          = "cron(0 7 1 * ? *)"

    lifecycle {
      delete_after = 365
    }

    dynamic "copy_action" {
      for_each = local.is_production ? [var.backup_copy_vault_arn] : []
      content {
        destination_vault_arn = copy_action.value

        lifecycle {
          delete_after = 365
        }
      }
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

resource "aws_iam_role_policy_attachment" "backup_restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
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

resource "aws_iam_role_policy" "task_execution_secrets" {
  count = var.upstream_rpc_secret_name == null ? 0 : 1
  name  = "${var.project_name}-task-execution-secrets"
  role  = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadExactEnvironmentRuntimeSecret"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.upstream_rpc[0].arn
      },
      {
        Sid      = "DecryptEnvironmentRuntimeSecret"
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = aws_kms_key.runtime.arn
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
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
        Sid    = "MountEnvironmentRuntimeStorage"
        Effect = "Allow"
        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite"
        ]
        Resource = aws_efs_file_system.runtime.arn
        Condition = {
          StringLike = {
            "elasticfilesystem:AccessPointArn" = local.efs_access_point_arn_pattern
          }
          Bool = {
            "aws:SecureTransport" = "true"
          }
        }
      },
      {
        Sid    = "OpenEcsExecChannels"
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
      },
      {
        Sid    = "WriteEcsExecAuditLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.ecs_exec.arn}:*"
      },
      {
        Sid      = "DecryptEcsExecSessionData"
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = aws_kms_key.runtime.arn
      }
    ]
  })
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
  # - EcsRuntimeCreation: create tagged ECS services in the one environment cluster.
  # - EcsRuntimeLifecycle: inspect/update/tag ECS services scoped to the one environment cluster.
  # - EcsRuntimeTaskRead: list environment services and inspect tasks in the one environment cluster.
  # - ExecuteRuntimeCheckpoint: execute audited commands only in the dedicated checkpoint sidecar.
  # - DenyUnloggedSsmSessions: prevent direct Session Manager sessions from bypassing ECS Exec audit logging.
  # - EcsTaskDefinitionRegistration: register tagged task definitions; the API requires Resource="*".
  # - EcsTaskDefinitionListing: list task-definition ARNs; the API requires Resource="*".
  # - EcsTaskDefinitionLifecycle: describe/deregister/delete only this environment's task-definition families.
  # - EcsCleanupTasks: run and verify one-off snapshot cleanup tasks scoped to runtime task/task-definition ARN patterns.
  # - ElbRuntimeCreation: create tag-scoped target groups; CreateTargetGroup requires Resource="*".
  # - ElbRuntimeRuleCreation: create rules only on declared shard listeners.
  # - ElbRuntimeRead: ELBv2 Describe APIs require Resource="*"; callers validate listener paths and ownership tags.
  # - ElbRuntimeLifecycle: modify/tag target groups and listener rules scoped to runtime ALB ARN patterns.
  # - EfsAccessPointCreation: create runtime snapshot access points on the runtime file system with required project tags.
  # - EfsAccessPointLifecycle: find/tag/delete runtime snapshot access points scoped to the runtime file system/AP patterns.
  # - RuntimeAlarms: create per-runtime health alarms with SNS actions.
  # - RuntimeAdmissionMetrics: publish shard admission counts only to the runtime control-plane metric namespace.
  # - RuntimeControlTable: acquire leases and persist sticky route assignments.
  # - RuntimeLogs: inspect runtime restore markers from CloudWatch Logs for deployment artifacts.
  # - EcsExecEncryption: generate data keys for encrypted, audited ECS Exec checkpoints.
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
        Sid      = "EcsRuntimeCreation"
        Effect   = "Allow"
        Action   = ["ecs:CreateService"]
        Resource = local.ecs_service_arn_pattern
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.runtime.arn
          }
          StringEquals = {
            "aws:RequestTag/Project"     = local.tags.Project
            "aws:RequestTag/Environment" = var.environment_id
          }
        }
      },
      {
        Sid    = "EcsRuntimeLifecycle"
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:ListTagsForResource",
          "ecs:TagResource",
          "ecs:UntagResource",
          "ecs:UpdateService"
        ]
        Resource = local.ecs_service_arn_pattern
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.runtime.arn
          }
        }
      },
      {
        Sid    = "EcsRuntimeTaskRead"
        Effect = "Allow"
        Action = [
          "ecs:DescribeTasks",
          "ecs:ListServices",
          "ecs:ListTasks"
        ]
        Resource = [aws_ecs_cluster.runtime.arn, local.ecs_task_arn_pattern, local.ecs_service_arn_pattern]
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.runtime.arn
          }
        }
      },
      {
        Sid      = "ExecuteRuntimeCheckpoint"
        Effect   = "Allow"
        Action   = ["ecs:ExecuteCommand"]
        Resource = [aws_ecs_cluster.runtime.arn, local.ecs_task_arn_pattern]
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.runtime.arn
          }
          StringEquals = {
            "ecs:container-name" = "runtime-checkpoint"
          }
        }
      },
      {
        Sid      = "DenyUnloggedSsmSessions"
        Effect   = "Deny"
        Action   = ["ssm:StartSession"]
        Resource = "*"
      },
      {
        Sid      = "EcsTaskDefinitionRegistration"
        Effect   = "Allow"
        Action   = ["ecs:RegisterTaskDefinition"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestTag/Project"     = local.tags.Project
            "aws:RequestTag/Environment" = var.environment_id
          }
        }
      },
      {
        Sid      = "EcsTaskDefinitionListing"
        Effect   = "Allow"
        Action   = ["ecs:ListTaskDefinitions"]
        Resource = "*"
      },
      {
        Sid    = "EcsTaskDefinitionLifecycle"
        Effect = "Allow"
        Action = [
          "ecs:DeleteTaskDefinitions",
          "ecs:DeregisterTaskDefinition",
          "ecs:DescribeTaskDefinition"
        ]
        Resource = local.environment_task_definition_arn_pattern
      },
      {
        Sid    = "EcsCleanupTasks"
        Effect = "Allow"
        Action = [
          "ecs:RunTask"
        ]
        Resource = [
          local.ecs_task_arn_pattern,
          local.ecs_task_definition_arn_pattern
        ]
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.runtime.arn
          }
          StringEquals = {
            "aws:RequestTag/Project"     = local.tags.Project
            "aws:RequestTag/Environment" = var.environment_id
          }
        }
      },
      {
        Sid      = "ElbRuntimeCreation"
        Effect   = "Allow"
        Action   = ["elasticloadbalancing:CreateTargetGroup"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestTag/Project"     = local.tags.Project
            "aws:RequestTag/Environment" = var.environment_id
          }
        }
      },
      {
        Sid      = "ElbRuntimeRuleCreation"
        Effect   = "Allow"
        Action   = ["elasticloadbalancing:CreateRule"]
        Resource = [for listener in values(aws_lb_listener.https) : listener.arn]
        Condition = {
          StringEquals = {
            "aws:RequestTag/Project"     = local.tags.Project
            "aws:RequestTag/Environment" = var.environment_id
          }
        }
      },
      {
        Sid    = "ElbRuntimeRead"
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeTags"
        ]
        Resource = "*"
      },
      {
        Sid    = "ElbRuntimeLifecycle"
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:ModifyRule",
          "elasticloadbalancing:AddTags"
        ]
        Resource = concat(
          [for listener in values(aws_lb_listener.https) : listener.arn],
          [local.elb_listener_rule_arn_pattern, local.elb_target_group_arn_pattern]
        )
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
            "aws:RequestTag/Project"     = local.tags.Project
            "aws:RequestTag/Environment" = var.environment_id
          }
        }
      },
      {
        Sid    = "EfsAccessPointLifecycle"
        Effect = "Allow"
        Action = [
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
          "cloudwatch:DescribeAlarms",
          "cloudwatch:PutMetricAlarm"
        ]
        Resource = local.runtime_alarm_arn_pattern
      },
      {
        Sid      = "RuntimeAdmissionMetrics"
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "Eternum/AwsRuntime"
          }
        }
      },
      {
        Sid    = "RuntimeControlTable"
        Effect = "Allow"
        Action = [
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:TransactWriteItems",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.runtime_control.arn
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
        Sid      = "EcsExecEncryption"
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey"]
        Resource = aws_kms_key.runtime.arn
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

resource "aws_iam_role" "github_runtime_maintenance" {
  name               = "${var.project_name}-github-maintenance"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume_role.json

  tags = local.tags
}

resource "aws_iam_role_policy" "github_runtime_maintenance" {
  name = "${var.project_name}-github-maintenance"
  role = aws_iam_role.github_runtime_maintenance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DeleteEnvironmentRuntimeServices"
        Effect = "Allow"
        Action = [
          "ecs:DeleteService",
          "ecs:DescribeServices",
          "ecs:ListServices",
          "ecs:ListTagsForResource"
        ]
        Resource = [aws_ecs_cluster.runtime.arn, local.ecs_service_arn_pattern]
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.runtime.arn
          }
        }
      },
      {
        Sid    = "InspectRuntimeTasks"
        Effect = "Allow"
        Action = [
          "ecs:DescribeTasks",
          "ecs:ListTasks"
        ]
        Resource = [
          aws_ecs_cluster.runtime.arn,
          local.ecs_service_arn_pattern,
          local.ecs_task_arn_pattern
        ]
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.runtime.arn
          }
        }
      },
      {
        Sid    = "RunRuntimeCleanupTask"
        Effect = "Allow"
        Action = ["ecs:RunTask"]
        Resource = [
          local.ecs_task_arn_pattern,
          local.ecs_task_definition_arn_pattern
        ]
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.runtime.arn
          }
          StringEquals = {
            "aws:RequestTag/Project"     = local.tags.Project
            "aws:RequestTag/Environment" = var.environment_id
          }
        }
      },
      {
        Sid      = "ExecuteRuntimeCheckpoint"
        Effect   = "Allow"
        Action   = ["ecs:ExecuteCommand"]
        Resource = [aws_ecs_cluster.runtime.arn, local.ecs_task_arn_pattern]
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.runtime.arn
          }
          StringEquals = {
            "ecs:container-name" = "runtime-checkpoint"
          }
        }
      },
      {
        Sid      = "DenyUnloggedSsmSessions"
        Effect   = "Deny"
        Action   = ["ssm:StartSession"]
        Resource = "*"
      },
      {
        Sid      = "ListRuntimeTaskDefinitions"
        Effect   = "Allow"
        Action   = ["ecs:ListTaskDefinitions"]
        Resource = "*"
      },
      {
        Sid    = "DeleteRuntimeTaskDefinitions"
        Effect = "Allow"
        Action = [
          "ecs:DeleteTaskDefinitions",
          "ecs:DeregisterTaskDefinition",
          "ecs:DescribeTaskDefinition"
        ]
        Resource = local.environment_task_definition_arn_pattern
      },
      {
        Sid    = "DeleteRuntimeRouting"
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:DeleteRule",
          "elasticloadbalancing:DeleteTargetGroup"
        ]
        Resource = [local.elb_listener_rule_arn_pattern, local.elb_target_group_arn_pattern]
      },
      {
        Sid    = "ReadRuntimeRouting"
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:DescribeTags",
          "elasticloadbalancing:DescribeTargetGroups"
        ]
        Resource = "*"
      },
      {
        Sid    = "DeleteRuntimeAccessPoints"
        Effect = "Allow"
        Action = [
          "elasticfilesystem:DeleteAccessPoint",
          "elasticfilesystem:DescribeAccessPoints"
        ]
        Resource = [aws_efs_file_system.runtime.arn, local.efs_access_point_arn_pattern]
      },
      {
        Sid      = "DeleteRuntimeAlarms"
        Effect   = "Allow"
        Action   = ["cloudwatch:DeleteAlarms", "cloudwatch:DescribeAlarms"]
        Resource = local.runtime_alarm_arn_pattern
      },
      {
        Sid    = "RuntimeControlTable"
        Effect = "Allow"
        Action = [
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:TransactWriteItems",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.runtime_control.arn
      },
      {
        Sid      = "EncryptEcsExecSessionData"
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey"]
        Resource = aws_kms_key.runtime.arn
      },
      {
        Sid      = "PassRuntimeRoles"
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.task_execution.arn, aws_iam_role.task.arn]
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role" "github_image_promotion" {
  name               = "${var.project_name}-github-image"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume_role.json

  tags = local.tags
}

resource "aws_iam_role_policy" "github_image_promotion" {
  name = "${var.project_name}-github-image"
  role = aws_iam_role.github_image_promotion.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Sid    = "PublishAndVerifyRuntimeImages"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImageScanFindings",
          "ecr:DescribeImages",
          "ecr:GetDownloadUrlForLayer",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:StartImageScan",
          "ecr:UploadLayerPart"
        ]
        Resource = aws_ecr_repository.runtime.arn
      },
      {
        Sid      = "AuthenticateToEcr"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      }
      ], length(var.candidate_ecr_repository_arns) > 0 ? [
      {
        Sid    = "VerifyAndPullCandidateImages"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:DescribeImageScanFindings",
          "ecr:DescribeImages",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = var.candidate_ecr_repository_arns
      }
      ] : []
    )
  })
}

resource "aws_iam_role" "github_dr" {
  name               = "${var.project_name}-github-dr"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume_role.json

  tags = local.tags
}

resource "aws_iam_role_policy" "github_dr" {
  name = "${var.project_name}-github-dr"
  role = aws_iam_role.github_dr.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Sid      = "ListEnvironmentRecoveryPoints"
        Effect   = "Allow"
        Action   = ["backup:ListRecoveryPointsByBackupVault"]
        Resource = aws_backup_vault.runtime.arn
      },
      {
        Sid    = "RestoreEnvironmentRecoveryPoints"
        Effect = "Allow"
        Action = [
          "backup:DescribeRecoveryPoint",
          "backup:GetRecoveryPointRestoreMetadata",
          "backup:StartRestoreJob"
        ]
        Resource = local.backup_recovery_point_arn_pattern
      },
      {
        Sid      = "ReadEnvironmentRestoreJobs"
        Effect   = "Allow"
        Action   = ["backup:DescribeRestoreJob"]
        Resource = "*"
      },
      {
        Sid    = "PromoteEnvironmentFileSystem"
        Effect = "Allow"
        Action = [
          "elasticfilesystem:CreateAccessPoint",
          "elasticfilesystem:CreateReplicationConfiguration",
          "elasticfilesystem:DeleteReplicationConfiguration",
          "elasticfilesystem:DescribeAccessPoints",
          "elasticfilesystem:DescribeFileSystems",
          "elasticfilesystem:DescribeReplicationConfigurations"
        ]
        Resource = [aws_efs_file_system.runtime.arn, local.efs_access_point_arn_pattern]
      },
      {
        Sid      = "PassBackupRestoreRole"
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = aws_iam_role.backup.arn
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "backup.amazonaws.com"
          }
        }
      }
      ], local.is_dr ? [
      {
        Sid      = "PrepareDestinationEfsReplication"
        Effect   = "Allow"
        Action   = ["elasticfilesystem:UpdateFileSystemProtection"]
        Resource = aws_efs_file_system.runtime.arn
      }
      ] : [], local.is_production ? [
      {
        Sid      = "PassEnvironmentEfsReplicationRole"
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = aws_iam_role.efs_replication[0].arn
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "elasticfilesystem.amazonaws.com"
          }
        }
      }
      ] : [], local.is_production ? [
      {
        Sid      = "UpdateRuntimeFailoverRecords"
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets"]
        Resource = "arn:aws:route53:::hostedzone/${var.hosted_zone_id}"
      }
      ] : [], local.is_production ? [
      {
        Sid      = "ReadRuntimeFailoverChange"
        Effect   = "Allow"
        Action   = ["route53:GetChange"]
        Resource = "arn:aws:route53:::change/*"
      }
      ] : []
    )
  })
}

resource "aws_iam_role_policy" "github_dr_runtime_recovery" {
  count  = local.is_dr ? 1 : 0
  name   = "${var.project_name}-github-dr-runtime-recovery"
  role   = aws_iam_role.github_dr.id
  policy = aws_iam_role_policy.github_runtime_deployer.policy
}

resource "aws_iam_role" "github_runtime_e2e" {
  count              = local.is_production || local.is_dr ? 0 : 1
  name               = "${var.project_name}-github-e2e"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume_role.json

  tags = local.tags
}

resource "aws_iam_role_policy" "github_runtime_e2e_deploy" {
  count  = local.is_production || local.is_dr ? 0 : 1
  name   = "${var.project_name}-github-e2e-deploy"
  role   = aws_iam_role.github_runtime_e2e[0].id
  policy = aws_iam_role_policy.github_runtime_deployer.policy
}

resource "aws_iam_role_policy" "github_runtime_e2e_maintenance" {
  count  = local.is_production || local.is_dr ? 0 : 1
  name   = "${var.project_name}-github-e2e-maintenance"
  role   = aws_iam_role.github_runtime_e2e[0].id
  policy = aws_iam_role_policy.github_runtime_maintenance.policy
}
