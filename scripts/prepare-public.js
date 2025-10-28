#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Prepare public directory by copying static assets
 * This ensures the public directory exists before Vite tries to use it
 */
function preparePublicDirectory() {
  const publicDir = join(rootDir, 'public');
  
  // Create public directory if it doesn't exist
  if (!existsSync(publicDir)) {
    console.log('Creating public directory...');
    mkdirSync(publicDir, { recursive: true });
  }

  // Files and directories to copy to public
  // Note: We only need stardict.db now, other files are unnecessary
  const assetsToCopy = [
    // stardict.db will be compressed during postbuild
    // eng_dict.txt and eng-zho.json are no longer needed
  ];

  console.log('Preparing public directory with static assets...');
  
  assetsToCopy.forEach(({ src, dest, type }) => {
    const srcPath = join(rootDir, src);
    const destPath = join(publicDir, dest);
    
    if (!existsSync(srcPath)) {
      console.warn(`Warning: Source ${src} not found, skipping...`);
      return;
    }
    
    try {
      if (type === 'file') {
        copyFileSync(srcPath, destPath);
        console.log(`✓ Copied ${src}`);
      } else if (type === 'dir') {
        cpSync(srcPath, destPath, { recursive: true });
        console.log(`✓ Copied ${src}/ directory`);
      }
    } catch (error) {
      console.error(`Error copying ${src}:`, error.message);
    }
  });
  
  console.log('Public directory preparation complete!');
}

// Run the script
preparePublicDirectory();
