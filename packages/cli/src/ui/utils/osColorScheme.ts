/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'node:child_process';
import process from 'node:process';
import { debugLogger } from '@google/gemini-cli-core';

export type OSColorScheme = 'dark' | 'light';

interface RunCommandResult {
  stdout: string;
  exitCode: number | null;
}

function runCommand(
  command: string,
  args: string[],
): Promise<RunCommandResult | undefined> {
  return new Promise((resolve) => {
    try {
      const child = execFile(
        command,
        args,
        { timeout: 500 },
        (error, stdout) => {
          if (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code === 'ENOENT') {
              resolve(undefined);
              return;
            }
            resolve({
              stdout: stdout ?? '',
              exitCode:
                ((error as NodeJS.ErrnoException & { status?: number })
                  .status ?? nodeError.code)
                  ? 1
                  : null,
            });
            return;
          }
          resolve({ stdout: stdout ?? '', exitCode: 0 });
        },
      );
      child.on('error', () => {
        resolve(undefined);
      });
    } catch {
      resolve(undefined);
    }
  });
}

async function detectMacOS(): Promise<OSColorScheme | undefined> {
  const result = await runCommand('defaults', [
    'read',
    '-g',
    'AppleInterfaceStyle',
  ]);
  if (result === undefined) {
    return undefined;
  }
  if (result.exitCode === 0 && /dark/i.test(result.stdout)) {
    return 'dark';
  }
  return 'light';
}

function parseWindowsRegOutput(stdout: string): OSColorScheme | undefined {
  const match = /AppsUseLightTheme\s+REG_DWORD\s+(0x[0-9a-fA-F]+)/i.exec(
    stdout,
  );
  if (!match) {
    return undefined;
  }
  const value = parseInt(match[1], 16);
  if (value === 0x0) {
    return 'dark';
  }
  if (value === 0x1) {
    return 'light';
  }
  return undefined;
}

async function detectWindows(): Promise<OSColorScheme | undefined> {
  const result = await runCommand('reg', [
    'query',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
    '/v',
    'AppsUseLightTheme',
  ]);
  if (result === undefined || result.exitCode !== 0) {
    return undefined;
  }
  return parseWindowsRegOutput(result.stdout);
}

async function detectLinux(): Promise<OSColorScheme | undefined> {
  const colorSchemeResult = await runCommand('gsettings', [
    'get',
    'org.gnome.desktop.interface',
    'color-scheme',
  ]);
  if (colorSchemeResult !== undefined && colorSchemeResult.exitCode === 0) {
    return /dark/i.test(colorSchemeResult.stdout) ? 'dark' : 'light';
  }

  const gtkThemeResult = await runCommand('gsettings', [
    'get',
    'org.gnome.desktop.interface',
    'gtk-theme',
  ]);
  if (gtkThemeResult !== undefined && gtkThemeResult.exitCode === 0) {
    return /dark/i.test(gtkThemeResult.stdout) ? 'dark' : 'light';
  }

  const gtkThemeEnv = process.env['GTK_THEME'];
  if (gtkThemeEnv && /dark/i.test(gtkThemeEnv)) {
    return 'dark';
  }

  return undefined;
}

export async function getOSColorScheme(): Promise<OSColorScheme | undefined> {
  try {
    switch (process.platform) {
      case 'darwin':
        return await detectMacOS();
      case 'win32':
        return await detectWindows();
      case 'linux':
        return await detectLinux();
      default:
        return undefined;
    }
  } catch (error) {
    debugLogger.warn('Failed to detect OS color scheme:', error);
    return undefined;
  }
}

export function shouldSwitchThemeForOSScheme(
  currentThemeName: string | undefined,
  scheme: OSColorScheme,
  defaultDarkName: string,
  defaultLightName: string,
): string | undefined {
  if (
    scheme === 'light' &&
    (currentThemeName === defaultDarkName || currentThemeName === undefined)
  ) {
    return defaultLightName;
  }
  if (scheme === 'dark' && currentThemeName === defaultLightName) {
    return defaultDarkName;
  }
  return undefined;
}

export const _testExports = {
  detectMacOS,
  detectWindows,
  detectLinux,
  parseWindowsRegOutput,
};
