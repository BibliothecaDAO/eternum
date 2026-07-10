data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = {
    Project          = "eternum"
    Service          = "runtime-github-oidc"
    EnvironmentClass = var.environment_class
  }
}

resource "terraform_data" "bootstrap_gate" {
  lifecycle {
    precondition {
      condition = (
        var.replication_destination_bucket_arn == null && var.replication_destination_kms_key_arn == null
        ) || (
        var.replication_destination_bucket_arn != null && var.replication_destination_kms_key_arn != null
      )
      error_message = "State replication requires both replication_destination_bucket_arn and replication_destination_kms_key_arn."
    }


    precondition {
      condition = !var.enable_state_replication || (
        var.replication_destination_bucket_arn != null && var.replication_destination_kms_key_arn != null
      )
      error_message = "enable_state_replication requires the destination bucket and KMS key ARNs."
    }

    precondition {
      condition = !contains(["production", "dr"], var.environment_class) || (
        var.ecr_replication_peer_account_id != null && length(var.ecr_replication_repository_prefixes) > 0
      )
      error_message = "Production and DR account bootstraps require an ECR peer account and repository prefixes."
    }
  }
}

resource "aws_ecr_replication_configuration" "runtime" {
  count = var.environment_class == "production" && var.enable_ecr_replication ? 1 : 0

  replication_configuration {
    rule {
      destination {
        region      = var.ecr_replication_destination_region
        registry_id = var.ecr_replication_peer_account_id
      }

      dynamic "repository_filter" {
        for_each = toset(var.ecr_replication_repository_prefixes)
        content {
          filter      = repository_filter.value
          filter_type = "PREFIX_MATCH"
        }
      }
    }
  }

  depends_on = [terraform_data.bootstrap_gate]
}

resource "aws_ecr_registry_policy" "runtime_replication" {
  count = var.environment_class == "dr" ? 1 : 0

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowProductionRuntimeReplication"
      Effect = "Allow"
      Principal = {
        AWS = "arn:aws:iam::${var.ecr_replication_peer_account_id}:root"
      }
      Action = ["ecr:ReplicateImage"]
      Resource = [
        for prefix in var.ecr_replication_repository_prefixes :
        "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/${prefix}*"
      ]
    }]
  })

  depends_on = [terraform_data.bootstrap_gate]
}

data "aws_iam_policy_document" "state_kms" {
  # checkov:skip=CKV_AWS_109:KMS key policies require Resource="*" to describe permissions on the key that owns the policy.
  # checkov:skip=CKV_AWS_111:KMS key policies require Resource="*" to describe permissions on the key that owns the policy.
  # checkov:skip=CKV_AWS_356:KMS key policies require Resource="*" to describe permissions on the key that owns the policy.
  statement {
    sid    = "EnableAccountAdministration"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }

    actions   = ["kms:*"]
    resources = ["*"]
  }

  dynamic "statement" {
    for_each = var.replication_source_role_arn == null ? [] : [var.replication_source_role_arn]
    content {
      sid    = "AllowCrossAccountStateReplication"
      effect = "Allow"

      principals {
        type        = "AWS"
        identifiers = [statement.value]
      }

      actions = [
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:Encrypt",
        "kms:GenerateDataKey",
        "kms:ReEncryptFrom",
        "kms:ReEncryptTo"
      ]
      resources = ["*"]
    }
  }
}

resource "aws_kms_key" "state" {
  description             = "Terraform state encryption for ${var.environment_class} runtime foundations"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.state_kms.json

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project          = "eternum"
    Service          = "runtime-terraform-state"
    EnvironmentClass = var.environment_class
  }
}

resource "aws_kms_alias" "state" {
  name          = "alias/eternum-runtime-state-${var.environment_class}"
  target_key_id = aws_kms_key.state.key_id
}

# This terminal state access-log sink cannot log to itself without creating an infinite delivery loop.
#trivy:ignore:s3-bucket-logging
resource "aws_s3_bucket" "state_access_logs" {
  bucket = "${substr(var.state_bucket_name, 0, 49)}-${substr(sha256(var.state_bucket_name), 0, 8)}-logs"

  # checkov:skip=CKV_AWS_18:This is the terminal server-access-log bucket; self-logging would recurse indefinitely.
  # checkov:skip=CKV_AWS_144:State objects are replicated cross-account; duplicating access telemetry is not part of the recovery contract.
  # checkov:skip=CKV_AWS_145:S3 server access-log delivery requires SSE-S3 on the destination bucket.
  # checkov:skip=CKV2_AWS_62:Access logs are audit evidence and do not trigger an object-processing workflow.

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project          = "eternum"
    Service          = "runtime-terraform-state-access-logs"
    EnvironmentClass = var.environment_class
  }
}

resource "aws_s3_bucket_public_access_block" "state_access_logs" {
  bucket                  = aws_s3_bucket.state_access_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "state_access_logs" {
  bucket = aws_s3_bucket.state_access_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 server access-log delivery requires SSE-S3 for this destination bucket.
#trivy:ignore:AVD-AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "state_access_logs" {
  bucket = aws_s3_bucket.state_access_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "state_access_logs" {
  bucket = aws_s3_bucket.state_access_logs.id

  rule {
    id     = "retain-state-access-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 365
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

data "aws_iam_policy_document" "state_access_logs" {
  statement {
    sid    = "AllowS3ServerAccessLogs"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["logging.s3.amazonaws.com"]
    }

    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.state_access_logs.arn}/state/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:s3:::${var.state_bucket_name}"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }

  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.state_access_logs.arn,
      "${aws_s3_bucket.state_access_logs.arn}/*"
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state_access_logs" {
  bucket = aws_s3_bucket.state_access_logs.id
  policy = data.aws_iam_policy_document.state_access_logs.json
}

resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name

  # checkov:skip=CKV2_AWS_62:State mutations are audited through S3 server access logs; no object-processing workflow is required.

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project          = "eternum"
    Service          = "runtime-terraform-state"
    EnvironmentClass = var.environment_class
  }
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    bucket_key_enabled = true

    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.state.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_logging" "state" {
  bucket        = aws_s3_bucket.state.id
  target_bucket = aws_s3_bucket.state_access_logs.id
  target_prefix = "state/"

  depends_on = [aws_s3_bucket_policy.state_access_logs]
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "retain-state-history"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

data "aws_iam_policy_document" "state_bucket" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.state.arn,
      "${aws_s3_bucket.state.arn}/*"
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid    = "DenyUnencryptedObjectWrites"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.state.arn}/*"]

    condition {
      test     = "StringNotEquals"
      variable = "s3:x-amz-server-side-encryption"
      values   = ["aws:kms"]
    }
  }

  dynamic "statement" {
    for_each = var.replication_source_role_arn == null ? [] : [var.replication_source_role_arn]
    content {
      sid    = "AllowCrossAccountStateReplication"
      effect = "Allow"

      principals {
        type        = "AWS"
        identifiers = [statement.value]
      }

      actions = [
        "s3:ObjectOwnerOverrideToBucketOwner",
        "s3:ReplicateDelete",
        "s3:ReplicateObject",
        "s3:ReplicateTags"
      ]
      resources = ["${aws_s3_bucket.state.arn}/*"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state_bucket.json
}

resource "aws_dynamodb_table" "locks" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.state.arn
  }

  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project          = "eternum"
    Service          = "runtime-terraform-state-locks"
    EnvironmentClass = var.environment_class
  }
}

resource "aws_iam_role" "state_replication" {
  count = var.replication_destination_bucket_arn == null ? 0 : 1
  name  = "eternum-runtime-state-replication-${var.environment_class}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "s3.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "state_replication" {
  count = var.replication_destination_bucket_arn == null ? 0 : 1
  name  = "eternum-runtime-state-replication"
  role  = aws_iam_role.state_replication[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging",
          "s3:ListBucket"
        ]
        Resource = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ObjectOwnerOverrideToBucketOwner",
          "s3:ReplicateDelete",
          "s3:ReplicateObject",
          "s3:ReplicateTags"
        ]
        Resource = "${var.replication_destination_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:ReEncryptFrom",
          "kms:ReEncryptTo"
        ]
        Resource = [aws_kms_key.state.arn, var.replication_destination_kms_key_arn]
      }
    ]
  })
}

resource "aws_s3_bucket_replication_configuration" "state" {
  count = (
    var.enable_state_replication &&
    var.replication_destination_bucket_arn != null &&
    var.replication_destination_kms_key_arn != null
  ) ? 1 : 0
  role   = aws_iam_role.state_replication[0].arn
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "replicate-to-isolated-dr"
    status = "Enabled"

    filter {}

    delete_marker_replication {
      status = "Enabled"
    }

    destination {
      bucket        = var.replication_destination_bucket_arn
      storage_class = "STANDARD"

      encryption_configuration {
        replica_kms_key_id = var.replication_destination_kms_key_arn
      }

      access_control_translation {
        owner = "Destination"
      }
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}
