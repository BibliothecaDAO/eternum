#!/usr/bin/env node
/**
 * Codemod to convert lucide-react barrel imports to direct imports.
 *
 * Usage: node scripts/codemod-lucide-imports.mjs [--dry-run] [--path <glob>]
 *
 * Examples:
 *   node scripts/codemod-lucide-imports.mjs --dry-run
 *   node scripts/codemod-lucide-imports.mjs --path "client/apps/game/src"
 */

import fs from "node:fs";
import path from "node:path";

const TYPE_IMPORTS = ["LucideIcon", "LucideProps", "Icon", "IconNode", "IconProps"];

// Use dist/esm/icons for lucide-react@0.365.0 which lacks package exports
const ICON_IMPORT_PATH = "lucide-react/dist/esm/icons";

function pascalToKebab(str) {
  return str
    // Handle transitions from lowercase/number to uppercase
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    // Handle transitions from uppercase to uppercase+lowercase (e.g., XMLParser -> XML-Parser)
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    // Handle transitions from letter to number (e.g., Loader2 -> Loader-2)
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .toLowerCase();
}

function parseImportSpecifier(spec) {
  // Handle: "Icon", "Icon as Alias", "type Icon", "type Icon as Alias"
  const trimmed = spec.trim();
  const isType = trimmed.startsWith("type ");
  const withoutType = isType ? trimmed.slice(5).trim() : trimmed;

  // Check for alias: "Something as SomethingElse"
  const aliasMatch = withoutType.match(/^(\w+)\s+as\s+(\w+)$/);
  if (aliasMatch) {
    return {
      originalName: aliasMatch[1],
      localName: aliasMatch[2],
      isType,
    };
  }

  return {
    originalName: withoutType,
    localName: withoutType,
    isType,
  };
}

function transformFile(filePath, dryRun) {
  const content = fs.readFileSync(filePath, "utf-8");

  // Match: import { Icon1, Icon2, type LucideIcon } from "lucide-react";
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["'];?/g;

  let newContent = content;
  const transformedIcons = [];

  newContent = content.replace(importRegex, (match, imports) => {
    const importList = imports
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const typeImports = [];
    const iconImports = [];

    for (const imp of importList) {
      const parsed = parseImportSpecifier(imp);

      if (parsed.isType || TYPE_IMPORTS.includes(parsed.originalName)) {
        // Keep type imports as-is in barrel form
        typeImports.push(imp);
      } else {
        iconImports.push(parsed);
        transformedIcons.push(parsed.originalName);
      }
    }

    const lines = [];

    // Type imports stay as barrel import
    if (typeImports.length > 0) {
      lines.push(`import { ${typeImports.join(", ")} } from "lucide-react";`);
    }

    // Icon imports become direct imports
    for (const icon of iconImports) {
      const kebabName = pascalToKebab(icon.originalName);
      // Default export is the icon, import as localName
      lines.push(`import ${icon.localName} from "${ICON_IMPORT_PATH}/${kebabName}";`);
    }

    return lines.join("\n");
  });

  const changed = newContent !== content;

  if (changed && !dryRun) {
    fs.writeFileSync(filePath, newContent, "utf-8");
  }

  return { changed, icons: transformedIcons };
}

function walkDir(dir, extensions = [".ts", ".tsx"]) {
  const results = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".git") {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const pathIndex = args.indexOf("--path");
  const searchPath = pathIndex !== -1 ? args[pathIndex + 1] : "client";

  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Search path: ${searchPath}\n`);

  const files = walkDir(searchPath);

  let totalChanged = 0;
  const allIcons = new Set();

  for (const file of files) {
    const { changed, icons } = transformFile(file, dryRun);
    if (changed) {
      totalChanged++;
      icons.forEach((i) => allIcons.add(i));
      console.log(`${dryRun ? "[DRY] " : ""}Modified: ${file}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Files modified: ${totalChanged}`);
  console.log(`  Unique icons: ${allIcons.size}`);
}

main();
