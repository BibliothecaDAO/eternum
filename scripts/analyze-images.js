#!/usr/bin/env node

import { readdir, stat } from "fs/promises";
import { join, dirname, extname, basename } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CLIENT_PUBLIC_DIR = join(__dirname, "../client/public");
const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
const EXCLUDE_DIRS = ["draco"]; // Skip 3D models and draco files

class ImageAnalyzer {
  constructor() {
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      typeStats: {},
      largeFiles: [],
      directories: {},
    };
  }

  async findImages(dir, images = [], relativePath = "") {
    try {
      const entries = await readdir(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);
        const currentRelativePath = join(relativePath, entry);

        if (stats.isDirectory()) {
          // Skip excluded directories
          if (!EXCLUDE_DIRS.includes(entry)) {
            await this.findImages(fullPath, images, currentRelativePath);
          }
        } else if (stats.isFile()) {
          const ext = extname(entry).toLowerCase();
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            const imageInfo = {
              path: fullPath,
              relativePath: currentRelativePath,
              size: stats.size,
              type: ext.substring(1), // Remove the dot
              directory: dirname(currentRelativePath) || ".",
              modified: stats.mtime,
            };
            images.push(imageInfo);

            // Update statistics
            this.stats.totalFiles++;
            this.stats.totalSize += stats.size;

            // Track by type
            if (!this.stats.typeStats[imageInfo.type]) {
              this.stats.typeStats[imageInfo.type] = { count: 0, size: 0 };
            }
            this.stats.typeStats[imageInfo.type].count++;
            this.stats.typeStats[imageInfo.type].size += stats.size;

            // Track by directory
            const dirKey = imageInfo.directory;
            if (!this.stats.directories[dirKey]) {
              this.stats.directories[dirKey] = { count: 0, size: 0 };
            }
            this.stats.directories[dirKey].count++;
            this.stats.directories[dirKey].size += stats.size;

            // Track large files (>100KB)
            if (stats.size > 100 * 1024) {
              this.stats.largeFiles.push(imageInfo);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error.message);
    }

    return images;
  }

  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  generateReport(images) {
    console.log("🖼️  Eternum Image Asset Analysis");
    console.log("==============================");

    console.log(`\n📊 Overview:`);
    console.log(`Total images: ${this.stats.totalFiles}`);
    console.log(`Total size: ${this.formatBytes(this.stats.totalSize)}`);
    console.log(`Average file size: ${this.formatBytes(this.stats.totalSize / this.stats.totalFiles)}`);

    console.log(`\n📁 By File Type:`);
    Object.entries(this.stats.typeStats)
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([type, data]) => {
        const avgSize = this.formatBytes(data.size / data.count);
        console.log(`  ${type.toUpperCase()}: ${data.count} files, ${this.formatBytes(data.size)} (avg: ${avgSize})`);
      });

    console.log(`\n📂 By Directory (top 10):`);
    Object.entries(this.stats.directories)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 10)
      .forEach(([dir, data]) => {
        console.log(`  ${dir}: ${data.count} files, ${this.formatBytes(data.size)}`);
      });

    console.log(`\n🐘 Largest Files (>100KB):`);
    this.stats.largeFiles
      .sort((a, b) => b.size - a.size)
      .slice(0, 15)
      .forEach((file, index) => {
        console.log(
          `  ${index + 1}. ${file.relativePath} (${this.formatBytes(file.size)}) - ${file.type.toUpperCase()}`,
        );
      });

    // Compression opportunities
    console.log(`\n🚀 Compression Opportunities:`);

    const gifs = images.filter((img) => img.type === "gif");
    if (gifs.length > 0) {
      const gifsSize = gifs.reduce((sum, gif) => sum + gif.size, 0);
      console.log(
        `  • ${gifs.length} GIF files (${this.formatBytes(gifsSize)}) - Consider converting to WebP or optimizing`,
      );
    }

    const largePngs = images.filter((img) => img.type === "png" && img.size > 50 * 1024);
    if (largePngs.length > 0) {
      const pngSize = largePngs.reduce((sum, png) => sum + png.size, 0);
      console.log(`  • ${largePngs.length} large PNG files (${this.formatBytes(pngSize)}) - Consider compression`);
    }

    const jpegs = images.filter((img) => ["jpg", "jpeg"].includes(img.type));
    if (jpegs.length > 0) {
      const jpegSize = jpegs.reduce((sum, jpg) => sum + jpg.size, 0);
      console.log(`  • ${jpegs.length} JPEG files (${this.formatBytes(jpegSize)}) - Consider quality optimization`);
    }

    const noWebP = images.filter((img) => ["png", "jpg", "jpeg"].includes(img.type));
    console.log(`  • ${noWebP.length} images could have WebP alternatives for modern browsers`);

    // Estimated savings
    console.log(`\n💾 Estimated Compression Savings:`);
    const compressibleFiles = images.filter(
      (img) => ["png", "jpg", "jpeg", "gif"].includes(img.type) && img.size > 1024,
    );
    const compressibleSize = compressibleFiles.reduce((sum, img) => sum + img.size, 0);
    const estimatedSavings = compressibleSize * 0.3; // Conservative 30% savings estimate

    console.log(`  • Compressible files: ${compressibleFiles.length} (${this.formatBytes(compressibleSize)})`);
    console.log(`  • Estimated savings: ${this.formatBytes(estimatedSavings)} (30% reduction)`);
    console.log(
      `  • Potential bundle size reduction: ${((estimatedSavings / this.stats.totalSize) * 100).toFixed(1)}%`,
    );

    console.log(`\n🛠️  Recommended Actions:`);
    console.log(`  1. Run image compression script to optimize existing images`);
    console.log(`  2. Consider generating WebP versions for modern browsers`);
    console.log(`  3. Review large files (>500KB) for manual optimization`);
    console.log(`  4. Implement lazy loading for images not immediately visible`);
    console.log(`  5. Use responsive images with different sizes for different viewports`);

    console.log(`\n💡 Next Steps:`);
    console.log(`  • Install compression tools: pnpm add -D sharp imagemin`);
    console.log(`  • Run: node scripts/compress-images-with-sharp.js --dry-run`);
    console.log(`  • Add image optimization to your build pipeline`);
  }

  async run() {
    // Check if client/public directory exists
    try {
      await stat(CLIENT_PUBLIC_DIR);
    } catch (error) {
      console.error(`❌ Client public directory not found: ${CLIENT_PUBLIC_DIR}`);
      process.exit(1);
    }

    console.log("🔍 Analyzing image assets...\n");
    const images = await this.findImages(CLIENT_PUBLIC_DIR);

    if (images.length === 0) {
      console.log("No images found in the public directory.");
      return;
    }

    this.generateReport(images);
  }
}

// Run the analyzer
const analyzer = new ImageAnalyzer();
analyzer.run().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
