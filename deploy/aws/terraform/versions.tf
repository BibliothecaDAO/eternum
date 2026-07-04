terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    key            = "aws-runtime/foundation.tfstate"
    region         = "us-east-1"
    dynamodb_table = "aws-runtime-foundation-locks"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
