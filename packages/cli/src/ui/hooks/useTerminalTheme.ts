/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { useStdout } from 'ink';
import {
  getLuminance,
  parseColor,
  shouldSwitchTheme,
} from '../themes/color-utils.js';
import { themeManager, DEFAULT_THEME } from '../themes/theme-manager.js';
import { DefaultLight } from '../themes/default-light.js';
import { useSettings } from '../contexts/SettingsContext.js';
import type { Config } from '@google/gemini-cli-core';
import { useTerminalContext } from '../contexts/TerminalContext.js';
import { SettingScope } from '../../config/settings.js';
import type { UIActions } from '../contexts/UIActionsContext.js';
import {
  getOSColorScheme,
  shouldSwitchThemeForOSScheme,
} from '../utils/osColorScheme.js';

export function useTerminalTheme(
  handleThemeSelect: UIActions['handleThemeSelect'],
  config: Config,
) {
  const { stdout } = useStdout();
  const settings = useSettings();
  const { subscribe, unsubscribe } = useTerminalContext();

  useEffect(() => {
    if (settings.merged.ui.autoThemeSwitching === false) {
      return;
    }

    const hasTerminalBackground = config.getTerminalBackground() !== undefined;

    if (hasTerminalBackground) {
      const pollIntervalId = setInterval(() => {
        const currentThemeName = settings.merged.ui.theme;
        if (!themeManager.isDefaultTheme(currentThemeName)) {
          return;
        }

        stdout.write('\x1b]11;?\x1b\\');
      }, settings.merged.ui.terminalBackgroundPollingInterval * 1000);

      const handleTerminalBackground = (colorStr: string) => {
        const match =
          /^rgb:([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})$/.exec(
            colorStr,
          );
        if (!match) return;

        const hexColor = parseColor(match[1], match[2], match[3]);
        const luminance = getLuminance(hexColor);
        config.setTerminalBackground(hexColor);

        const currentThemeName = settings.merged.ui.theme;

        const newTheme = shouldSwitchTheme(
          currentThemeName,
          luminance,
          DEFAULT_THEME.name,
          DefaultLight.name,
        );

        if (newTheme) {
          handleThemeSelect(newTheme, SettingScope.User);
        }
      };

      subscribe(handleTerminalBackground);

      return () => {
        clearInterval(pollIntervalId);
        unsubscribe(handleTerminalBackground);
      };
    }

    const intervalSeconds = Math.max(
      settings.merged.ui.terminalBackgroundPollingInterval,
      5,
    );
    let lastScheme: string | undefined;

    const pollOSScheme = async () => {
      const currentThemeName = settings.merged.ui.theme;
      if (!themeManager.isDefaultTheme(currentThemeName)) {
        return;
      }

      const scheme = await getOSColorScheme();
      if (!scheme || scheme === lastScheme) {
        return;
      }
      lastScheme = scheme;

      const newTheme = shouldSwitchThemeForOSScheme(
        currentThemeName,
        scheme,
        DEFAULT_THEME.name,
        DefaultLight.name,
      );

      if (newTheme) {
        handleThemeSelect(newTheme, SettingScope.User);
      }
    };

    const osIntervalId = setInterval(pollOSScheme, intervalSeconds * 1000);

    return () => {
      clearInterval(osIntervalId);
    };
  }, [
    settings.merged.ui.theme,
    settings.merged.ui.autoThemeSwitching,
    settings.merged.ui.terminalBackgroundPollingInterval,
    stdout,
    config,
    handleThemeSelect,
    subscribe,
    unsubscribe,
  ]);
}
