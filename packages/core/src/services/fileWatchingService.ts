/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { LruCache } from '../utils/LruCache.js';

export interface FileWatchingService {
  /**
   * Attempts to resolve a file path that may have been renamed.
   * @param originalPath The original file path
   * @param workingDir The working directory to resolve relative paths
   * @returns The current file path if found, or null if not found
   */
  resolveFileAfterRename(originalPath: string, workingDir: string): string | null;

  /**
   * Checks if a file exists, and if not, tries to find a similar file
   * @param filePath The file path to check
   * @param workingDir The working directory
   * @returns The resolved file path or null if not found
   */
  findBestMatch(filePath: string, workingDir: string): string | null;

  /**
   * Clears the internal cache
   */
  clearCache(): void;
}

export class DefaultFileWatchingService implements FileWatchingService {
  private fileCache = new LruCache<string, string>(1000);
  private directoryCache = new LruCache<string, string[]>(100);

  resolveFileAfterRename(originalPath: string, workingDir: string): string | null {
    const absolutePath = path.resolve(workingDir, originalPath);
    const cacheKey = `resolve:${absolutePath}`;
    
    // Check cache first
    const cached = this.fileCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // If the file exists at the original path, return it
    if (fs.existsSync(absolutePath)) {
      this.fileCache.set(cacheKey, absolutePath);
      return absolutePath;
    }

    // Try to find the file using fuzzy matching
    const bestMatch = this.findBestMatch(originalPath, workingDir);
    if (bestMatch) {
      this.fileCache.set(cacheKey, bestMatch);
      return bestMatch;
    }

    return null;
  }

  findBestMatch(filePath: string, workingDir: string): string | null {
    const absolutePath = path.resolve(workingDir, filePath);
    const fileName = path.basename(filePath);
    const dirPath = path.dirname(absolutePath);

    // Check if the directory exists
    if (!fs.existsSync(dirPath)) {
      return null;
    }

    // Get directory contents (with caching)
    const dirContents = this.getDirectoryContents(dirPath);
    if (!dirContents) {
      return null;
    }

    // Try exact filename match first
    if (dirContents.includes(fileName)) {
      return path.join(dirPath, fileName);
    }

    // Try case-insensitive match
    const lowerFileName = fileName.toLowerCase();
    const caseInsensitiveMatch = dirContents.find(
      (file) => file.toLowerCase() === lowerFileName
    );
    if (caseInsensitiveMatch) {
      return path.join(dirPath, caseInsensitiveMatch);
    }

    // Try fuzzy matching based on file extension and similar names
    const fileExt = path.extname(fileName);
    const baseName = path.basename(fileName, fileExt);
    
    // Look for files with the same extension
    const sameExtFiles = dirContents.filter(
      (file) => path.extname(file) === fileExt
    );

    // Find the best match based on similarity
    let bestMatch = null;
    let bestScore = 0;

    for (const file of sameExtFiles) {
      const candidateBaseName = path.basename(file, fileExt);
      const score = this.calculateSimilarity(baseName, candidateBaseName);
      
      if (score > bestScore && score > 0.6) { // Threshold for similarity
        bestScore = score;
        bestMatch = file;
      }
    }

    if (bestMatch) {
      return path.join(dirPath, bestMatch);
    }

    return null;
  }

  private getDirectoryContents(dirPath: string): string[] | null {
    const cacheKey = `dir:${dirPath}`;
    
    // Check cache first
    let cached = this.directoryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const contents = fs.readdirSync(dirPath);
      // Filter out directories for file matching
      const files = contents.filter((item) => {
        const itemPath = path.join(dirPath, item);
        try {
          return fs.statSync(itemPath).isFile();
        } catch {
          return false;
        }
      });
      
      this.directoryCache.set(cacheKey, files);
      return files;
    } catch {
      return null;
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance based similarity
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLen = Math.max(str1.length, str2.length);
    return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  clearCache(): void {
    this.fileCache.clear();
    this.directoryCache.clear();
  }
}