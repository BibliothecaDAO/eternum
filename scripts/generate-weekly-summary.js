#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Weekly Code Summary Generator for Eternum
 *
 * Generates a comprehensive weekly summary of repository changes including:
 * - Contributor statistics
 * - Major changes by package/area
 * - Notable commits and features
 * - Package-specific updates
 */

const DAYS_TO_ANALYZE = parseInt(process.env.DAYS_TO_ANALYZE || "7");
const OUTPUT_PATH = process.env.OUTPUT_PATH || "weekly-summary.md";

function executeGitCommand(command) {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch (error) {
    console.error(`Failed to execute git command: ${command}`);
    console.error(error.message);
    return "";
  }
}

function getDateRange() {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - DAYS_TO_ANALYZE * 24 * 60 * 60 * 1000);

  return {
    start: startDate.toISOString().split("T")[0],
    end: endDate.toISOString().split("T")[0],
    startFormatted: startDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    endFormatted: endDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

function getContributorStats(since) {
  const gitLog = executeGitCommand(`git log --since="${since}" --pretty=format:"%ae|%an|%s|%ad" --date=short`);

  if (!gitLog) return { contributors: [], totalCommits: 0 };

  const commits = gitLog.split("\n").filter((line) => line.trim());
  const contributorMap = new Map();

  commits.forEach((commit) => {
    const [email, name] = commit.split("|");
    if (contributorMap.has(email)) {
      contributorMap.get(email).commits++;
    } else {
      contributorMap.set(email, { name, email, commits: 1 });
    }
  });

  const contributors = Array.from(contributorMap.values()).sort((a, b) => b.commits - a.commits);

  return { contributors, totalCommits: commits.length };
}

function getChangedFiles(since) {
  const changedFiles = executeGitCommand(
    `git log --since="${since}" --name-only --pretty=format: | sort | uniq -c | sort -nr`,
  );

  if (!changedFiles) return [];

  return changedFiles
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const match = line.trim().match(/(\d+)\s+(.+)/);
      return match ? { count: parseInt(match[1]), file: match[2] } : null;
    })
    .filter(Boolean)
    .slice(0, 20); // Top 20 most changed files
}

function getPackageChanges(since) {
  const packages = [
    "client",
    "packages/core",
    "packages/dojo",
    "packages/provider",
    "packages/react",
    "packages/torii",
    "packages/types",
    "contracts",
  ];

  const packageChanges = {};

  packages.forEach((pkg) => {
    const commits = executeGitCommand(`git log --since="${since}" --oneline -- ${pkg}/ | wc -l`);
    const files = executeGitCommand(
      `git log --since="${since}" --name-only --pretty=format: -- ${pkg}/ | sort | uniq | wc -l`,
    );

    if (parseInt(commits) > 0) {
      packageChanges[pkg] = {
        commits: parseInt(commits),
        files: parseInt(files),
      };
    }
  });

  return packageChanges;
}

function getNotableCommits(since) {
  const commits = executeGitCommand(`git log --since="${since}" --pretty=format:"%h|%s|%an|%ad" --date=short`);

  if (!commits) return [];

  return commits
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [hash, subject, autor, date] = line.split("|");
      return { hash, subject, autor, date };
    })
    .filter((commit) => {
      const subject = commit.subject.toLowerCase();
      // Filter for notable commits (features, major fixes, breaking changes)
      return (
        subject.includes("feat") ||
        subject.includes("feature") ||
        subject.includes("breaking") ||
        subject.includes("major") ||
        subject.includes("add") ||
        subject.includes("implement")
      );
    })
    .slice(0, 15); // Top 15 notable commits
}

function generateSummary() {
  const dateRange = getDateRange();
  const { contributors, totalCommits } = getContributorStats(dateRange.start);
  const changedFiles = getChangedFiles(dateRange.start);
  const packageChanges = getPackageChanges(dateRange.start);
  const notableCommits = getNotableCommits(dateRange.start);

  let summary = `# Eternum Weekly Code Summary\n\n`;
  summary += `**Period:** ${dateRange.startFormatted} - ${dateRange.endFormatted}\n\n`;
  summary += `**Generated:** ${new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })}\n\n`;

  // Overview
  summary += `## 📊 Overview\n\n`;
  summary += `- **Total Commits:** ${totalCommits}\n`;
  summary += `- **Active Contributors:** ${contributors.length}\n`;
  summary += `- **Files Modified:** ${changedFiles.length > 0 ? changedFiles[0].count : 0}\n`;
  summary += `- **Packages Updated:** ${Object.keys(packageChanges).length}\n\n`;

  // Contributors
  if (contributors.length > 0) {
    summary += `## 👥 Contributors\n\n`;
    contributors.forEach((contributor, index) => {
      const displayName = contributor.name || contributor.email.split("@")[0];
      summary += `${index + 1}. **${displayName}** - ${contributor.commits} commit${contributor.commits > 1 ? "s" : ""}\n`;
    });
    summary += `\n`;
  }

  // Package Changes
  if (Object.keys(packageChanges).length > 0) {
    summary += `## 📦 Package Activity\n\n`;
    Object.entries(packageChanges)
      .sort(([, a], [, b]) => b.commits - a.commits)
      .forEach(([pkg, stats]) => {
        summary += `- **${pkg}**: ${stats.commits} commits, ${stats.files} files modified\n`;
      });
    summary += `\n`;
  }

  // Notable Commits
  if (notableCommits.length > 0) {
    summary += `## ✨ Notable Changes\n\n`;
    notableCommits.forEach((commit) => {
      summary += `- \`${commit.hash}\` ${commit.subject} - *${commit.autor}* (${commit.date})\n`;
    });
    summary += `\n`;
  }

  // Most Changed Files
  if (changedFiles.length > 0) {
    summary += `## 📁 Most Active Files\n\n`;
    changedFiles.slice(0, 10).forEach((file) => {
      summary += `- \`${file.file}\` (${file.count} changes)\n`;
    });
    summary += `\n`;
  }

  // Repository Health
  summary += `## 🏥 Repository Health\n\n`;

  // Check for recent test additions
  const testFiles = executeGitCommand(
    `git log --since="${dateRange.start}" --name-only --pretty=format: | grep -E "\\.(test|spec)\\." | wc -l`,
  );

  // Check for documentation updates
  const docFiles = executeGitCommand(
    `git log --since="${dateRange.start}" --name-only --pretty=format: | grep -E "\\.(md|mdx)$" | wc -l`,
  );

  summary += `- **Test Files Updated:** ${testFiles || 0}\n`;
  summary += `- **Documentation Updates:** ${docFiles || 0}\n`;

  // Add git stats
  const additions = executeGitCommand(
    `git log --since="${dateRange.start}" --numstat --pretty=format: | awk '{added+=$1} END {print added}'`,
  );
  const deletions = executeGitCommand(
    `git log --since="${dateRange.start}" --numstat --pretty=format: | awk '{deleted+=$2} END {print deleted}'`,
  );

  summary += `- **Lines Added:** ${additions || 0}\n`;
  summary += `- **Lines Removed:** ${deletions || 0}\n\n`;

  // Footer
  summary += `---\n\n`;
  summary += `*This summary was automatically generated from git history analysis.*\n`;
  summary += `*For detailed changes, review individual commits and pull requests.*\n\n`;
  summary += `**Repository:** [BibliothecaDAO/eternum](https://github.com/BibliothecaDAO/eternum)\n`;
  summary += `**Branch:** next\n`;

  return summary;
}

function main() {
  console.log(`Generating weekly summary for the last ${DAYS_TO_ANALYZE} days...`);

  try {
    const summary = generateSummary();

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    if (outputDir !== "." && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, summary, "utf8");
    console.log(`✅ Weekly summary generated successfully: ${OUTPUT_PATH}`);

    // Also log summary stats for GitHub Actions
    const lines = summary.split("\n").length;
    console.log(`📄 Summary contains ${lines} lines`);
  } catch (error) {
    console.error("❌ Failed to generate weekly summary:", error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateSummary, getContributorStats, getPackageChanges };
