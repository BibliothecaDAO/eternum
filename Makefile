SHELL := /bin/bash

AWS_RUNTIME_E2E_ARGS ?=

.PHONY: aws-runtime-e2e
aws-runtime-e2e:
	@node scripts/aws-runtime-e2e.mjs $(AWS_RUNTIME_E2E_ARGS)
