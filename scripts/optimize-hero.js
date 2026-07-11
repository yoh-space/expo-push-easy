#!/usr/bin/env node
/**
 * Optimize hero image and generate retina @2x variant.
 *
 * - Place your original image at `assets/hero-source.png` (recommended)
 * - Run: `pnpm run optimize-hero` (or `node scripts/optimize-hero.js`)
 * - Outputs: `assets/hero.png`, `assets/hero@2x.png`, and `assets/hero.webp`
 */
import fs from 'fs'
import path from 'path'

async function main() {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch (err) {
    console.error('The `sharp` package is required. Install with: pnpm add -D sharp')
    process.exit(1)
  }

  const src = path.resolve(process.cwd(), 'assets', 'hero-source.png')
  const outPng = path.resolve(process.cwd(), 'assets', 'hero.png')
  const out2x = path.resolve(process.cwd(), 'assets', 'hero@2x.png')
  const outWebp = path.resolve(process.cwd(), 'assets', 'hero.webp')

  if (!fs.existsSync(src)) {
    console.error('Source image not found: assets/hero-source.png')
    console.error('Place your original hero image at that path and re-run the script.')
    process.exit(1)
  }

  try {
    // Create standard width (1200px) PNG
    await sharp(src)
      .resize({ width: 1200, withoutEnlargement: true })
      .png({ compressionLevel: 8 })
      .toFile(outPng)

    // Create retina 2x PNG (2400px)
    await sharp(src)
      .resize({ width: 2400, withoutEnlargement: true })
      .png({ compressionLevel: 8 })
      .toFile(out2x)

    // Create WebP
    await sharp(src)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outWebp)

    console.log('Generated:', outPng)
    console.log('Generated:', out2x)
    console.log('Generated:', outWebp)
  } catch (err) {
    console.error('Error generating hero assets:', err)
    process.exit(1)
  }
}

main()
