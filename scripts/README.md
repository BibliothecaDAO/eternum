# Scripts

This directory contains utility scripts for the Eternum project.

## Weekly Summary Generator

The weekly summary generator (`generate-weekly-summary.js`) creates comprehensive markdown summaries of repository activity over specified time periods.

### Features

- **Contributor Statistics**: Shows active contributors and their commit counts
- **Package Activity**: Breaks down changes by package (client, core, dojo, etc.)
- **Notable Changes**: Highlights feature additions and major updates
- **File Activity**: Lists most frequently modified files
- **Repository Health**: Tracks test and documentation updates
- **Code Statistics**: Shows lines added/removed

### Usage

#### Manual Execution

```bash
# Generate weekly summary (last 7 days)
pnpm run summary:weekly

# Generate monthly summary (last 30 days)
pnpm run summary:monthly

# Custom time period and output
DAYS_TO_ANALYZE=14 OUTPUT_PATH=biweekly-summary.md node scripts/generate-weekly-summary.js
```

#### Automated via GitHub Actions

The script runs automatically every Monday at 9 AM UTC via the `weekly-summary.yml` workflow:

- Creates a markdown summary file
- Opens a pull request with the summary
- Targets the `next` branch for review

#### Manual Workflow Trigger

You can manually trigger the workflow from the GitHub Actions tab with custom parameters:

- **Days**: Number of days to analyze (default: 7)
- **Output Path**: Where to save the summary (default: weekly-summary.md)

### Environment Variables

- `DAYS_TO_ANALYZE`: Number of days to look back (default: 7)
- `OUTPUT_PATH`: Output file path (default: weekly-summary.md)
- `GITHUB_TOKEN`: GitHub token for API access (set automatically in workflows)

### Output Format

The generated summary includes:

1. **Overview**: High-level statistics
2. **Contributors**: Ranked by commit count
3. **Package Activity**: Changes by package/directory
4. **Notable Changes**: Feature commits and major updates
5. **Most Active Files**: Frequently modified files
6. **Repository Health**: Tests, docs, and code stats

### Example Output

```markdown
# Eternum Weekly Code Summary

**Period:** December 14, 2024 - December 21, 2024

## 📊 Overview

- **Total Commits:** 47
- **Active Contributors:** 8
- **Files Modified:** 156
- **Packages Updated:** 6

## 👥 Contributors

1. **alice** - 15 commits
2. **bob** - 12 commits
3. **charlie** - 8 commits

## 📦 Package Activity

- **client**: 20 commits, 45 files modified
- **packages/core**: 12 commits, 23 files modified
- **contracts**: 8 commits, 15 files modified
```

### Integration

This summary can be used for:

- **Weekly Team Updates**: Share with the development team
- **Community Updates**: Publish to Discord, Twitter, or blogs
- **Project Management**: Track development velocity
- **Stakeholder Reports**: Communicate progress to stakeholders

### Dependencies

The script uses only Node.js built-ins:
- `child_process` for git commands
- `fs` for file operations
- `path` for path manipulation

No additional dependencies are required.