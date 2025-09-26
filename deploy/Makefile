SHELL := /bin/bash

DEPLOY_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
SCRIPTS_DIR := $(DEPLOY_DIR)/scripts

ENV ?= prod
PR ?=
AUTO_APPROVE ?= false
SKIP_BUILD ?= false
INCLUDE_MOBILE ?= false

maybe_auto_approve := $(if $(filter true,$(AUTO_APPROVE)),--auto-approve,)
maybe_skip_build := $(if $(filter true,$(SKIP_BUILD)),--skip-build,)
maybe_include_mobile := $(if $(filter true,$(INCLUDE_MOBILE)),--include-mobile,)
maybe_pr := $(if $(PR),--pr $(PR),)

COMMON_FLAGS := --env $(ENV) $(maybe_pr) $(maybe_skip_build) $(maybe_include_mobile)

.PHONY: help build plan deploy preview clean-preview check-preview-pr check-pr

help:
	@echo "Targets:"
	@echo "  make build [INCLUDE_MOBILE=true]"
	@echo "  make plan ENV=<env> [PR=<number>] [SKIP_BUILD=true]"
	@echo "  make deploy ENV=<env> [PR=<number>] [AUTO_APPROVE=true] [SKIP_BUILD=true] [INCLUDE_MOBILE=true]"
	@echo "  make preview PR=<number> [AUTO_APPROVE=true]"
	@echo "Variables: ENV (default prod), PR, AUTO_APPROVE, SKIP_BUILD, INCLUDE_MOBILE"

build:
	$(SCRIPTS_DIR)/build-static.sh $(maybe_include_mobile)

check-preview-pr:
	@if [ "$(ENV)" = "preview" ] && [ -z "$(PR)" ]; then \
		echo "Set PR=<number> when ENV=preview" >&2; \
		exit 1; \
	fi

check-pr:
	@if [ "$(strip $(PR))" = "" ]; then \
		echo "Set PR=<number> for this target" >&2; \
		exit 1; \
	fi

plan: check-preview-pr
	$(SCRIPTS_DIR)/deploy.sh $(COMMON_FLAGS) --plan

deploy: check-preview-pr
	$(SCRIPTS_DIR)/deploy.sh $(COMMON_FLAGS) $(maybe_auto_approve)

preview: check-pr
	@$(MAKE) deploy ENV=preview PR=$(PR)

clean-preview: check-pr
	rm -f $(DEPLOY_DIR)/terraform/.generated/preview-pr-$(PR).tfvars
	rm -f $(DEPLOY_DIR)/artifacts/pr-$(PR).env
