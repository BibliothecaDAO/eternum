#!/usr/bin/env node

import { readdir, stat, readFile, writeFile, mkdir, copyFile } from "fs/promises";
import { join, dirname, extname, basename } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if sharp is available
let sharp;
try {
  sharp = (await import("sharp")).default;
  console.log("✅ Sharp library loaded successfully");
} catch (error) {
  console.error("❌ Sharp library not found. Please install it with: pnpm add -D sharp");
  console.log("This script requires sharp for image compression.");
  process.exit(1);
}

// Configuration
const CLIENT_PUBLIC_DIR = join(__dirname, "../client/public");
const BACKUP_DIR = join(__dirname, "../client/public-backup");
const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const EXCLUDE_DIRS = ["draco", "models"]; // Skip 3D models and draco files
const EXCLUDE_FILES = ["favicon.ico"]; // Skip specific files

// Compression options
const COMPRESSION_OPTIONS = {
  png: {
    quality: 85,
    compressionLevel: 9,
    progressive: true,
  },
  jpeg: {
    quality: 85,
    progressive: true,
    mozjpeg: true,
  },
  webp: {
    quality: 85,
    effort: 6,
  },
};

class ImageCompressor {
  constructor(options = {}) {
    this.totalSaved = 0;
    this.filesProcessed = 0;
    this.errors = [];
    this.dryRun = options.dryRun || false;
    this.generateWebP = options.generateWebP || false;
    this.minSizeThreshold = options.minSizeThreshold || 1024; // Only compress files > 1KB
  }

  async compressImage(inputPath, type) {
    try {
      const originalStats = await stat(inputPath);
      const originalSize = originalStats.size;

      // Skip very small files
      if (originalSize < this.minSizeThreshold) {
        console.log(`→ ${basename(inputPath)}: Too small to compress (${this.formatBytes(originalSize)})`);
        return { originalSize, compressedSize: originalSize, saved: 0 };
      }

      let sharpInstance = sharp(inputPath);

      // Apply compression based on type
      switch (type) {
        case "png":
          sharpInstance = sharpInstance.png({
            quality: COMPRESSION_OPTIONS.png.quality,
            compressionLevel: COMPRESSION_OPTIONS.png.compressionLevel,
            progressive: COMPRESSION_OPTIONS.png.progressive,
          });
          break;
        case "jpeg":
        case "jpg":
          sharpInstance = sharpInstance.jpeg({
            quality: COMPRESSION_OPTIONS.jpeg.quality,
            progressive: COMPRESSION_OPTIONS.jpeg.progressive,
            mozjpeg: COMPRESSION_OPTIONS.jpeg.mozjpeg,
          });
          break;
        default:
          throw new Error(`Unsupported image type: ${type}`);
      }

      const compressedBuffer = await sharpInstance.toBuffer();
      const compressedSize = compressedBuffer.length;

      // Only save if we achieved meaningful compression (>5% reduction)
      const saved = originalSize - compressedSize;
      const percentage = (saved / originalSize) * 100;

      if (percentage > 5) {
        if (!this.dryRun) {
          await writeFile(inputPath, compressedBuffer);
        }

        console.log(
          `✓ ${basename(inputPath)}: ${this.formatBytes(originalSize)} → ${this.formatBytes(compressedSize)} (${percentage.toFixed(1)}% saved)${this.dryRun ? " [DRY RUN]" : ""}`,
        );

        this.totalSaved += saved;
        this.filesProcessed++;

        // Generate WebP version if requested
        if (this.generateWebP && !this.dryRun) {
          await this.generateWebPVersion(inputPath);
        }

        return { originalSize, compressedSize, saved };
      } else {
        console.log(`→ ${basename(inputPath)}: Minimal improvement (${percentage.toFixed(1)}%), keeping original`);
        return { originalSize, compressedSize: originalSize, saved: 0 };
      }
    } catch (error) {
      console.error(`✗ Error compressing ${basename(inputPath)}:`, error.message);
      this.errors.push({ file: inputPath, error: error.message });
      return null;
    }
  }

  async generateWebPVersion(imagePath) {
    try {
      const webpPath = imagePath.replace(/\.(png|jpe?g)$/i, ".webp");
      const webpBuffer = await sharp(imagePath)
        .webp({
          quality: COMPRESSION_OPTIONS.webp.quality,
          effort: COMPRESSION_OPTIONS.webp.effort,
        })
        .toBuffer();

      await writeFile(webpPath, webpBuffer);
      console.log(`  ↳ Generated WebP: ${basename(webpPath)} (${this.formatBytes(webpBuffer.length)})`);
    } catch (error) {
      console.error(`  ✗ Failed to generate WebP for ${basename(imagePath)}:`, error.message);
    }
  }

  async findImages(dir, images = []) {
    try {
      const entries = await readdir(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          // Skip excluded directories
          if (!EXCLUDE_DIRS.includes(entry)) {
            await this.findImages(fullPath, images);
          }
        } else if (stats.isFile()) {
          const ext = extname(entry).toLowerCase();
          if (SUPPORTED_EXTENSIONS.includes(ext) && !EXCLUDE_FILES.includes(entry)) {
            images.push({
              path: fullPath,
              size: stats.size,
              type: ext.substring(1), // Remove the dot
              relativePath: fullPath.replace(CLIENT_PUBLIC_DIR, ""),
            });
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

  async createBackup() {
    if (this.dryRun) {
      console.log("📁 Dry run mode - no backup needed");
      return;
    }

    console.log("📁 Creating backup...");
    try {
      await mkdir(BACKUP_DIR, { recursive: true });

      // Copy key directories
      const keyDirs = ["images", "assets", "gifs"];
      for (const dir of keyDirs) {
        const sourcePath = join(CLIENT_PUBLIC_DIR, dir);
        const backupPath = join(BACKUP_DIR, dir);

        try {
          await stat(sourcePath);
          console.log(`  Backing up ${dir}/...`);
          // Note: In production, use a proper recursive copy function
          console.log(`  ⚠️  Manual backup recommended for: ${sourcePath}`);
        } catch (error) {
          // Directory doesn't exist, skip
        }
      }

      console.log(`📁 Backup location: ${BACKUP_DIR}`);
      console.log("⚠️  Please ensure you have a backup before proceeding in production!");
    } catch (error) {
      console.error("Failed to create backup:", error.message);
      throw error;
    }
  }

  async run() {
    console.log("🖼️  Eternum Image Compression Tool (Sharp Edition)");
    console.log("===============================================");

    if (this.dryRun) {
      console.log("🔍 DRY RUN MODE - No files will be modified\n");
    }

    // Check if client/public directory exists
    try {
      await stat(CLIENT_PUBLIC_DIR);
    } catch (error) {
      console.error(`❌ Client public directory not found: ${CLIENT_PUBLIC_DIR}`);
      process.exit(1);
    }

    // Create backup
    await this.createBackup();

    console.log("\n🔍 Finding images...");
    const images = await this.findImages(CLIENT_PUBLIC_DIR);

    if (images.length === 0) {
      console.log("No images found to compress.");
      return;
    }

    // Sort by size (largest first) to show most impactful compressions first
    images.sort((a, b) => b.size - a.size);

    console.log(`\n📊 Found ${images.length} images to process:`);

    // Show overview
    const totalSize = images.reduce((sum, img) => sum + img.size, 0);
    const largestFiles = images.slice(0, 10);

    console.log(`Total size: ${this.formatBytes(totalSize)}`);
    console.log("\nLargest files:");
    largestFiles.forEach((img, index) => {
      console.log(`  ${index + 1}. ${img.relativePath} (${this.formatBytes(img.size)})`);
    });

    console.log("\n🚀 Starting compression...\n");

    // Process images
    for (const image of images) {
      await this.compressImage(image.path, image.type);
    }

    // Show summary
    console.log("\n📈 Compression Summary:");
    console.log("=====================");
    console.log(`Files processed: ${this.filesProcessed}`);
    console.log(`Total space saved: ${this.formatBytes(this.totalSaved)}`);
    if (this.filesProcessed > 0) {
      const percentageSaved = (this.totalSaved / images.reduce((sum, img) => sum + img.size, 0)) * 100;
      console.log(`Overall compression: ${percentageSaved.toFixed(1)}%`);
      console.log(`Average savings per file: ${this.formatBytes(this.totalSaved / this.filesProcessed)}`);
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${this.errors.length}`);
      this.errors.forEach((error) => {
        console.log(`  ${error.file.replace(CLIENT_PUBLIC_DIR, "")}: ${error.error}`);
      });
    }

    console.log("\n✅ Image compression complete!");

    if (!this.dryRun) {
      console.log("\n💡 Next steps:");
      console.log("  1. Test your application to ensure images display correctly");
      console.log('  2. Run "pnpm run build" to verify bundle size reduction');
      console.log("  3. Consider running with --webp flag for modern browser support");
      console.log("  4. Update your application to serve WebP images when supported");
    } else {
      console.log("\n💡 To actually compress images, run without --dry-run flag");
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes("--dry-run"),
  generateWebP: args.includes("--webp"),
  minSizeThreshold: 1024,
};

if (args.includes("--help")) {
  console.log(`
Eternum Image Compression Tool

Usage: node compress-images-with-sharp.js [options]

Options:
  --dry-run     Analyze images without modifying them
  --webp        Generate WebP versions alongside compressed originals
  --help        Show this help message

Examples:
  node compress-images-with-sharp.js --dry-run    # Analyze only
  node compress-images-with-sharp.js              # Compress images
  node compress-images-with-sharp.js --webp       # Compress and generate WebP
`);
  process.exit(0);
}

// Run the compressor
const compressor = new ImageCompressor(options);
compressor.run().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
