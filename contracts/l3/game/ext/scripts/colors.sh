#!/bin/bash

# =============================================================================
# Terminal Colors Configuration
# =============================================================================
#
# DESCRIPTION:
#   Defines ANSI color codes for consistent terminal output styling across
#   multiple scripts.
#
# USAGE:
#   source ./utils/colors.sh
#
# =============================================================================

# Basic colors
export GREEN=$(echo -e '\033[0;32m')
export BLUE=$(echo -e '\033[0;34m')
export YELLOW=$(echo -e '\033[1;33m')
export RED=$(echo -e '\033[0;31m')

# Text styles
export BOLD=$(echo -e '\033[1m')
export NC=$(echo -e '\033[0m') # No Color