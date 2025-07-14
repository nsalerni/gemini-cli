/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DefaultFileWatchingService } from './fileWatchingService.js';

vi.mock('fs');

describe('DefaultFileWatchingService', () => {
  let service: DefaultFileWatchingService;
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    service = new DefaultFileWatchingService();
    vi.clearAllMocks();
  });

  describe('resolveFileAfterRename', () => {
    it('should return the original path if file exists', () => {
      const originalPath = 'test.txt';
      const workingDir = '/project';
      const expectedPath = path.resolve(workingDir, originalPath);

      mockFs.existsSync.mockReturnValue(true);

      const result = service.resolveFileAfterRename(originalPath, workingDir);

      expect(result).toBe(expectedPath);
      expect(mockFs.existsSync).toHaveBeenCalledWith(expectedPath);
    });

    it('should return null if file does not exist and no similar files found', () => {
      const originalPath = 'nonexistent.txt';
      const workingDir = '/project';

      mockFs.existsSync.mockReturnValue(false);
      (mockFs.readdirSync as any).mockReturnValue([]);

      const result = service.resolveFileAfterRename(originalPath, workingDir);

      expect(result).toBeNull();
    });

    it('should find a renamed file with similar name', () => {
      const originalPath = 'old-file.txt';
      const workingDir = '/project';
      const expectedPath = path.resolve(workingDir, originalPath);

      mockFs.existsSync.mockImplementation((filePath) => {
        if (filePath === expectedPath) return false;
        if (filePath === path.dirname(expectedPath)) return true;
        return (
          filePath === path.join(path.dirname(expectedPath), 'new-file.txt')
        );
      });

      (mockFs.readdirSync as any).mockReturnValue(['new-file.txt', 'other.js']);
      mockFs.statSync.mockImplementation(
        (filePath) =>
          ({
            isFile: () => filePath.toString().endsWith('.txt'),
          }) as fs.Stats,
      );

      const result = service.resolveFileAfterRename(originalPath, workingDir);

      expect(result).toBe(
        path.join(path.dirname(expectedPath), 'new-file.txt'),
      );
    });

    it('should handle case-insensitive matching', () => {
      const originalPath = 'Test.TXT';
      const workingDir = '/project';
      const expectedPath = path.resolve(workingDir, originalPath);

      mockFs.existsSync.mockImplementation((filePath) => {
        if (filePath === expectedPath) return false;
        if (filePath === path.dirname(expectedPath)) return true;
        return filePath === path.join(path.dirname(expectedPath), 'test.txt');
      });

      (mockFs.readdirSync as any).mockReturnValue(['test.txt', 'other.js']);
      mockFs.statSync.mockImplementation(
        (filePath) =>
          ({
            isFile: () => filePath.toString().endsWith('.txt'),
          }) as fs.Stats,
      );

      const result = service.resolveFileAfterRename(originalPath, workingDir);

      expect(result).toBe(path.join(path.dirname(expectedPath), 'test.txt'));
    });
  });

  describe('findBestMatch', () => {
    it('should return exact match if found', () => {
      const filePath = 'test.txt';
      const workingDir = '/project';
      const dirPath = path.resolve(workingDir);

      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as any).mockReturnValue(['test.txt', 'other.js']);
      mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);

      const result = service.findBestMatch(filePath, workingDir);

      expect(result).toBe(path.join(dirPath, 'test.txt'));
    });

    it('should return null if directory does not exist', () => {
      const filePath = 'test.txt';
      const workingDir = '/nonexistent';

      mockFs.existsSync.mockReturnValue(false);

      const result = service.findBestMatch(filePath, workingDir);

      expect(result).toBeNull();
    });

    it('should find files with similar names and same extension', () => {
      const filePath = 'oldname.txt';
      const workingDir = '/project';
      const dirPath = path.resolve(workingDir);

      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as any).mockReturnValue([
        'old-name.txt',
        'completely-different.js',
      ]);
      mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);

      const result = service.findBestMatch(filePath, workingDir);

      expect(result).toBe(path.join(dirPath, 'old-name.txt'));
    });
  });

  describe('clearCache', () => {
    it('should clear internal caches', () => {
      // Set up some cache state
      service.resolveFileAfterRename('test.txt', '/project');

      // Clear cache
      service.clearCache();

      // This should not throw and should work normally
      expect(() => service.clearCache()).not.toThrow();
    });
  });
});
