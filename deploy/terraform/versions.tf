terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.28"
    }

    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.28"
    }
  }
}
