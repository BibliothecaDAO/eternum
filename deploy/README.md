# Terraform deployment scaffolding

This folder contains a Terraform based deployment flow for serving the Eternum game clients on Google Cloud.

## Layout

- `terraform/` – reusable Terraform root configuration and modules.
  - `modules/static_site` – provisions a Cloud Storage bucket, HTTPS load balancer, SSL certificate, and optional Cloud
    DNS record for a Vite build.
  - `modules/env_secret` – seeds Secret Manager with an environment file so builds can hydrate `.env` content.
  - `modules/project_services` – enables required Google APIs.
  - `environments/` – example and templated `terraform.tfvars` files for production and preview targets.
- `scripts/` – helper automation.
  - `build-static.sh` – builds Vite bundles and stages artifacts under `deploy/artifacts`.
  - `deploy.sh` – wraps Terraform init/plan/apply, renders preview tfvars, and uploads artifacts with `gsutil`.
- `ci/github-preview.yml` – GitHub Actions example job that deploys previews per PR.
- `templates/` – stub `.env` example for preview builds.

## Prerequisites

- `terraform >= 1.6`
- `pnpm`
- `gcloud` CLI with `gsutil`
- `jq`
- A Google Cloud project with Cloud DNS for your domains
- A remote state bucket (`backend.tf.example` can be copied to `backend.tf` once the bucket exists)

Authenticate `gcloud` so `terraform` and `gsutil` can reuse the application default credentials:

```bash
gcloud auth application-default login
```

## Configure environments

1. Copy `terraform/backend.tf.example` to `terraform/backend.tf` and fill in the remote state bucket name.
2. Copy `terraform/environments/prod/terraform.tfvars.example` to `terraform/environments/prod/terraform.tfvars` and
   update domains, DNS zone, and labels.
3. Place a populated env file referenced by the tfvars (for the example this is `deploy/artifacts/prod.env`). The
   `env_secret` module will push the file into Secret Manager.
4. (Optional) Adjust `terraform/variables.tf` defaults if you need different API sets or service account naming.

### Preview domains per PR

Preview deployments rely on the template `terraform/environments/preview/terraform.tfvars.tmpl`. `deploy.sh` injects
runtime values such as the PR number, project id, and preview base domain. Provide the following environment variables
before invoking the script:

- `GCP_PROJECT_ID`
- `PREVIEW_BASE_DOMAIN` (e.g. `preview.example.com` when PRs map to `pr-123.preview.example.com`)
- `PREVIEW_DNS_ZONE` (Cloud DNS managed zone name that owns `PREVIEW_BASE_DOMAIN`)
- `PREVIEW_BUCKET_LOCATION` (optional, defaults to `DEFAULT_LOCATION`)

The script will create `deploy/artifacts/pr-<pr>.env` from `templates/preview.env.stub` if the env file is missing and
exit so you can fill it. Commit your real secrets to Secret Manager or inject via CI secrets before rerunning.

## Make targets

A `Makefile` in this directory wraps the scripts for repeatable commands.

Run everything from the repository root with `make -C deploy <target>`:

- Production deploy with auto approve:

  ```bash
  make -C deploy deploy AUTO_APPROVE=true
  ```

- Preview deploy for PR 123 (requires preview env vars described earlier):

  ```bash
  make -C deploy preview PR=123 AUTO_APPROVE=true
  ```

- Terraform plan for prod without rebuilding assets:

  ```bash
  make -C deploy plan SKIP_BUILD=true
  ```

Common variables:

- `ENV` – target environment (`prod` by default, `preview` used by the `preview` target)
- `PR` – pull request number (required when `ENV=preview`)
- `AUTO_APPROVE` – pass through to Terraform apply (`false` by default)
- `SKIP_BUILD` – skip the Vite build step when set to `true`
- `INCLUDE_MOBILE` – include the mobile client build when set to `true`

You can still invoke the scripts directly if you prefer:

```bash
deploy/scripts/deploy.sh --env prod --auto-approve
deploy/scripts/deploy.sh --env preview --pr 123 --auto-approve
deploy/scripts/deploy.sh --env prod --plan
```

Add `--skip-build` or `--include-mobile` as needed.

## CI integration

See `ci/github-preview.yml` for a GitHub Actions example. The job performs the following:

- Authenticates via Workload Identity Federation.
- Writes the preview `.env` file from repository secrets.
- Invokes `deploy.sh` with the PR number.

Mirror this for production deploys (e.g. on `main`) by supplying the production tfvars file and env file.

## Next steps

- Register real domains in Cloud DNS and point registrar NS records at Google.
- Replace stub env values with the required Vite configuration.
- Extend `deploy/scripts/deploy.sh` if you need to push additional assets (mobile bundle, API docs, etc.).
