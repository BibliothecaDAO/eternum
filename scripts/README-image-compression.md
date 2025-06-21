# Image Compression Scripts for Eternum

This directory contains scripts to analyze and compress image assets to reduce bundle size for the Eternum game client.

## Scripts Overview

### 1. `analyze-images.js` - Image Asset Analysis
Analyzes all image assets in the client/public directory without making any changes.

**Features:**
- Scans for PNG, JPEG, GIF, SVG, and WebP files
- Provides detailed statistics by file type and directory
- Identifies large files and compression opportunities
- Estimates potential space savings
- No dependencies required

**Usage:**
```bash
pnpm run images:analyze
```

### 2. `compress-images-with-sharp.js` - Image Compression
Compresses images using the Sharp library for optimal results.

**Features:**
- Lossless and lossy compression for PNG, JPEG
- Optional WebP generation for modern browsers
- Dry-run mode for testing
- Backup recommendations
- Configurable quality settings

**Usage:**
```bash
# Install dependencies first
pnpm add -D sharp

# Analyze without changes
pnpm run images:compress:dry-run

# Compress images
pnpm run images:compress

# Compress and generate WebP versions
pnpm run images:compress:webp
```

### 3. `compress-images.js` - Basic Compression (Legacy)
A basic version that shows the compression framework without external dependencies.

## Installation and Setup

### Prerequisites
```bash
# For advanced compression (recommended)
pnpm add -D sharp

# Optional: For additional format support
pnpm add -D imagemin imagemin-optipng imagemin-mozjpeg imagemin-gifsicle
```

### Quick Start

1. **Analyze your current images:**
   ```bash
   pnpm run images:analyze
   ```

2. **Test compression (dry run):**
   ```bash
   pnpm run images:compress:dry-run
   ```

3. **Create a backup:**
   ```bash
   cp -r client/public client/public-backup
   ```

4. **Run compression:**
   ```bash
   pnpm run images:compress
   ```

## Configuration

### Compression Settings

The compression scripts use these default settings (in `compress-images-with-sharp.js`):

```javascript
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
  }
};
```

### Excluded Directories
- `draco/` - 3D model files
- `models/` - 3D model assets

### File Size Thresholds
- Minimum file size for compression: 1KB
- Minimum improvement required: 5%

## Expected Results

Based on typical web projects, you can expect:

- **PNG files:** 20-50% size reduction
- **JPEG files:** 10-30% size reduction  
- **GIF files:** 30-70% size reduction (or convert to WebP)
- **Overall bundle reduction:** 15-40% depending on asset composition

## Integration with Build Process

### Option 1: Manual Optimization (Recommended)
Run compression scripts before major releases:

```bash
pnpm run images:analyze
pnpm run images:compress:dry-run
pnpm run images:compress
pnpm run build
```

### Option 2: Build Pipeline Integration
Add to your CI/CD pipeline or pre-build hooks.

### Option 3: Vite Plugin (Future Enhancement)
Consider integrating with Vite build process using plugins like:
- `vite-plugin-imagemin`
- `@rollup/plugin-image`

## WebP Support

Modern browsers support WebP format which offers superior compression:

1. **Generate WebP versions:**
   ```bash
   pnpm run images:compress:webp
   ```

2. **Update your application** to serve WebP when supported:
   ```html
   <picture>
     <source srcset="image.webp" type="image/webp">
     <img src="image.png" alt="description">
   </picture>
   ```

## Troubleshooting

### Common Issues

1. **Sharp installation problems:**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   pnpm add -D sharp
   ```

2. **Permission errors:**
   ```bash
   # Make scripts executable
   chmod +x scripts/*.js
   ```

3. **Memory issues with large images:**
   - Process images in smaller batches
   - Increase Node.js memory limit: `node --max-old-space-size=4096`

### Performance Tips

- Run compression during off-peak hours
- Use `--dry-run` first to estimate time required
- Monitor disk space during compression
- Test your application after compression

## Best Practices

1. **Always backup** your images before compression
2. **Test thoroughly** after compression to ensure visual quality
3. **Run analysis first** to understand your asset distribution
4. **Use dry-run mode** to preview changes
5. **Monitor bundle size** before and after compression
6. **Consider WebP** for modern browser support
7. **Implement lazy loading** for images not immediately visible

## Advanced Usage

### Custom Quality Settings
Edit the `COMPRESSION_OPTIONS` in `compress-images-with-sharp.js` for different quality/size tradeoffs.

### Selective Compression
Modify the `EXCLUDE_DIRS` and `EXCLUDE_FILES` arrays to skip specific assets.

### Batch Processing
For very large projects, consider processing images in smaller batches by directory.

## Contributing

When adding new compression features:

1. Update this README
2. Add appropriate error handling
3. Include dry-run support
4. Add progress reporting
5. Test with various image types and sizes

## Related Documentation

- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [WebP Format Guide](https://developers.google.com/speed/webp)
- [Vite Asset Handling](https://vitejs.dev/guide/assets.html)