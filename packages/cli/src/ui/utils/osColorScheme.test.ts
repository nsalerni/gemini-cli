/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

import {
  shouldSwitchThemeForOSScheme,
  getOSColorScheme,
  _testExports,
} from './osColorScheme.js';

const { parseWindowsRegOutput } = _testExports;

const DEFAULT_DARK = 'default';
const DEFAULT_LIGHT = 'default-light';

describe('osColorScheme', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('shouldSwitchThemeForOSScheme', () => {
    it('should return light theme when scheme is light and current is default dark', () => {
      expect(
        shouldSwitchThemeForOSScheme(
          DEFAULT_DARK,
          'light',
          DEFAULT_DARK,
          DEFAULT_LIGHT,
        ),
      ).toBe(DEFAULT_LIGHT);
    });

    it('should return light theme when scheme is light and current is undefined', () => {
      expect(
        shouldSwitchThemeForOSScheme(
          undefined,
          'light',
          DEFAULT_DARK,
          DEFAULT_LIGHT,
        ),
      ).toBe(DEFAULT_LIGHT);
    });

    it('should return dark theme when scheme is dark and current is default light', () => {
      expect(
        shouldSwitchThemeForOSScheme(
          DEFAULT_LIGHT,
          'dark',
          DEFAULT_DARK,
          DEFAULT_LIGHT,
        ),
      ).toBe(DEFAULT_DARK);
    });

    it('should return undefined when scheme is dark and current is already default dark', () => {
      expect(
        shouldSwitchThemeForOSScheme(
          DEFAULT_DARK,
          'dark',
          DEFAULT_DARK,
          DEFAULT_LIGHT,
        ),
      ).toBeUndefined();
    });

    it('should return undefined when scheme is light and current is already default light', () => {
      expect(
        shouldSwitchThemeForOSScheme(
          DEFAULT_LIGHT,
          'light',
          DEFAULT_DARK,
          DEFAULT_LIGHT,
        ),
      ).toBeUndefined();
    });

    it('should return undefined when current theme is a custom theme', () => {
      expect(
        shouldSwitchThemeForOSScheme(
          'custom-theme',
          'light',
          DEFAULT_DARK,
          DEFAULT_LIGHT,
        ),
      ).toBeUndefined();

      expect(
        shouldSwitchThemeForOSScheme(
          'custom-theme',
          'dark',
          DEFAULT_DARK,
          DEFAULT_LIGHT,
        ),
      ).toBeUndefined();
    });
  });

  describe('parseWindowsRegOutput', () => {
    it('should return dark when output contains REG_DWORD 0x0', () => {
      const output =
        'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\n    AppsUseLightTheme    REG_DWORD    0x0\n';
      expect(parseWindowsRegOutput(output)).toBe('dark');
    });

    it('should return light when output contains REG_DWORD 0x1', () => {
      const output =
        'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\n    AppsUseLightTheme    REG_DWORD    0x1\n';
      expect(parseWindowsRegOutput(output)).toBe('light');
    });

    it('should return undefined for empty output', () => {
      expect(parseWindowsRegOutput('')).toBeUndefined();
    });

    it('should return undefined for invalid output', () => {
      expect(parseWindowsRegOutput('some random text')).toBeUndefined();
    });
  });

  describe('getOSColorScheme', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should detect dark mode on macOS', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
        const callback = args[args.length - 1] as (
          err: null,
          stdout: string,
        ) => void;
        callback(null, 'Dark');
        return { on: vi.fn() } as unknown as ReturnType<typeof execFile>;
      }) as typeof execFile);

      const result = await getOSColorScheme();
      expect(result).toBe('dark');
    });

    it('should detect light mode on macOS when command fails', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
        const callback = args[args.length - 1] as (err: Error) => void;
        callback(new Error('exit code 1'));
        return { on: vi.fn() } as unknown as ReturnType<typeof execFile>;
      }) as typeof execFile);

      const result = await getOSColorScheme();
      expect(result).toBe('light');
    });

    it('should detect dark mode on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const regOutput =
        'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\n    AppsUseLightTheme    REG_DWORD    0x0\n';
      vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
        const callback = args[args.length - 1] as (
          err: null,
          stdout: string,
        ) => void;
        callback(null, regOutput);
        return { on: vi.fn() } as unknown as ReturnType<typeof execFile>;
      }) as typeof execFile);

      const result = await getOSColorScheme();
      expect(result).toBe('dark');
    });

    it('should detect light mode on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const regOutput =
        'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\n    AppsUseLightTheme    REG_DWORD    0x1\n';
      vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
        const callback = args[args.length - 1] as (
          err: null,
          stdout: string,
        ) => void;
        callback(null, regOutput);
        return { on: vi.fn() } as unknown as ReturnType<typeof execFile>;
      }) as typeof execFile);

      const result = await getOSColorScheme();
      expect(result).toBe('light');
    });

    it('should detect dark mode on Linux via gsettings', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
        const callback = args[args.length - 1] as (
          err: null,
          stdout: string,
        ) => void;
        callback(null, 'prefer-dark');
        return { on: vi.fn() } as unknown as ReturnType<typeof execFile>;
      }) as typeof execFile);

      const result = await getOSColorScheme();
      expect(result).toBe('dark');
    });

    it('should detect light mode on Linux via gsettings', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
        const callback = args[args.length - 1] as (
          err: null,
          stdout: string,
        ) => void;
        callback(null, 'default');
        return { on: vi.fn() } as unknown as ReturnType<typeof execFile>;
      }) as typeof execFile);

      const result = await getOSColorScheme();
      expect(result).toBe('light');
    });

    it('should return undefined for unknown platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'freebsd' });

      const result = await getOSColorScheme();
      expect(result).toBeUndefined();
    });
  });
});
