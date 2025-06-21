#!/usr/bin/env node

import { readdir, stat, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CLIENT_PUBLIC_DIR = join(__dirname, '../client/public');
const BACKUP_DIR = join(__dirname, '../client/public-backup');
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif'];
const EXCLUDE_DIRS = ['draco', 'models']; // Skip 3D models and draco files

// Compression options
const COMPRESSION_OPTIONS = {
  png: {
    quality: [0.7, 0.9], // Quality range for PNG
    effort: 7, // Compression effort (0-10)
  },
  jpeg: {
    quality: 85, // JPEG quality (0-100)
    progressive: true,
  },
  gif: {
    optimizationLevel: 3, // GIF optimization level (1-3)
  }
};

class ImageCompressor {
  constructor() {
    this.totalSaved = 0;
    this.filesProcessed = 0;
    this.errors = [];
  }

  async compressImage(inputPath, outputPath, type) {
    try {
      const inputBuffer = await readFile(inputPath);
      const originalSize = inputBuffer.length;
      
      let compressedBuffer;
      
      switch (type) {
        case 'png':
          compressedBuffer = await this.compressPNG(inputBuffer);
          break;
        case 'jpeg':
        case 'jpg':
          compressedBuffer = await this.compressJPEG(inputBuffer);
          break;
        case 'gif':
          compressedBuffer = await this.compressGIF(inputBuffer);
          break;
        default:
          throw new Error(`Unsupported image type: ${type}`);
      }

      // Only save if we achieved compression
      if (compressedBuffer.length < originalSize) {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, compressedBuffer);
        
        const saved = originalSize - compressedBuffer.length;
        const percentage = ((saved / originalSize) * 100).toFixed(1);
        
        console.log(`✓ ${basename(inputPath)}: ${this.formatBytes(originalSize)} → ${this.formatBytes(compressedBuffer.length)} (${percentage}% saved)`);
        
        this.totalSaved += saved;
        this.filesProcessed++;
        
        return { originalSize, compressedSize: compressedBuffer.length, saved };
      } else {
        console.log(`→ ${basename(inputPath)}: No improvement, keeping original`);
        return { originalSize, compressedSize: originalSize, saved: 0 };
      }
    } catch (error) {
      console.error(`✗ Error compressing ${basename(inputPath)}:`, error.message);
      this.errors.push({ file: inputPath, error: error.message });
      return null;
    }
  }

  async compressPNG(buffer) {
    // Simplified PNG compression using built-in Node.js
    // For production, consider using sharp or imagemin-optipng
    return buffer; // Placeholder - would need actual compression library
  }

  async compressJPEG(buffer) {
    // Simplified JPEG compression
    // For production, consider using sharp or imagemin-mozjpeg
    return buffer; // Placeholder - would need actual compression library
  }

  async compressGIF(buffer) {
    // Simplified GIF compression
    // For production, consider using imagemin-gifsicle
    return buffer; // Placeholder - would need actual compression library
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
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            images.push({
              path: fullPath,
              size: stats.size,
              type: ext.substring(1) // Remove the dot
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
    console.log('📁 Creating backup...');
    try {
      // Simple backup - in production, consider using rsync or cp -r
      console.log(`Backup would be created at: ${BACKUP_DIR}`);
      console.log('⚠️  For safety, manually backup your images before running compression');
    } catch (error) {
      console.error('Failed to create backup:', error.message);
      throw error;
    }
  }

  async run() {
    console.log('🖼️  Eternum Image Compression Tool');
    console.log('==================================');
    
    // Check if client/public directory exists
    try {
      await stat(CLIENT_PUBLIC_DIR);
    } catch (error) {
      console.error(`❌ Client public directory not found: ${CLIENT_PUBLIC_DIR}`);
      process.exit(1);
    }

    // Create backup
    await this.createBackup();

    console.log('\n🔍 Finding images...');
    const images = await this.findImages(CLIENT_PUBLIC_DIR);
    
    if (images.length === 0) {
      console.log('No images found to compress.');
      return;
    }

    // Sort by size (largest first) to show most impactful compressions first
    images.sort((a, b) => b.size - a.size);

    console.log(`\n📊 Found ${images.length} images to process:`);
    
    // Show overview
    const totalSize = images.reduce((sum, img) => sum + img.size, 0);
    const largestFiles = images.slice(0, 5);
    
    console.log(`Total size: ${this.formatBytes(totalSize)}`);
    console.log('\nLargest files:');
    largestFiles.forEach(img => {
      const relativePath = img.path.replace(CLIENT_PUBLIC_DIR, '');
      console.log(`  ${relativePath} (${this.formatBytes(img.size)})`);
    });

    console.log('\n🚀 Starting compression...\n');

    // Process images
    for (const image of images) {
      await this.compressImage(image.path, image.path, image.type);
    }

    // Show summary
    console.log('\n📈 Compression Summary:');
    console.log('=====================');
    console.log(`Files processed: ${this.filesProcessed}`);
    console.log(`Total space saved: ${this.formatBytes(this.totalSaved)}`);
    console.log(`Average savings per file: ${this.formatBytes(this.totalSaved / Math.max(this.filesProcessed, 1))}`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${this.errors.length}`);
      this.errors.forEach(error => {
        console.log(`  ${error.file}: ${error.error}`);
      });
    }

    console.log('\n✅ Image compression complete!');
    console.log('\n💡 Next steps:');
    console.log('  1. Test your application to ensure images display correctly');
    console.log('  2. Run your build process to verify bundle size reduction');
    console.log('  3. Consider adding WebP conversion for modern browsers');
  }
}

// Show warning about dependencies
console.log('⚠️  DEPENDENCY WARNING:');
console.log('This script requires image compression libraries to function properly.');
console.log('Install the following dependencies:');
console.log('  pnpm add -D sharp imagemin imagemin-optipng imagemin-mozjpeg imagemin-gifsicle');
console.log('\nFor now, this script will analyze your images without actual compression.\n');

// Run the compressor
const compressor = new ImageCompressor();
compressor.run().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});