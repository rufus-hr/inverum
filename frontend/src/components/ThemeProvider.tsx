import React, { useEffect, useRef } from 'react';
import { useThemeStore } from '../store/themeStore';
import type { AppTheme } from '../lib/theme';

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  const c = theme.colors;
  const f = theme.fontSize;

  // Colors
  root.style.setProperty('--t-primary',       c.primary);
  root.style.setProperty('--t-primary-hover', c.primaryHover);
  root.style.setProperty('--t-primary-fg',    c.primaryFg);

  root.style.setProperty('--t-bg',            c.bg);
  root.style.setProperty('--t-surface',       c.surface);
  root.style.setProperty('--t-surface-hover', c.surfaceHover);

  root.style.setProperty('--t-border',        c.border);
  root.style.setProperty('--t-border-strong', c.borderStrong);

  root.style.setProperty('--t-text',          c.text);
  root.style.setProperty('--t-text-muted',    c.textMuted);
  root.style.setProperty('--t-text-subtle',   c.textSubtle);

  root.style.setProperty('--t-danger',        c.danger);
  root.style.setProperty('--t-danger-bg',     c.dangerBg);
  root.style.setProperty('--t-warning',       c.warning);
  root.style.setProperty('--t-warning-bg',    c.warningBg);
  root.style.setProperty('--t-success',       c.success);
  root.style.setProperty('--t-success-bg',    c.successBg);
  root.style.setProperty('--t-info',          c.info);
  root.style.setProperty('--t-info-bg',       c.infoBg);

  // Font sizes
  root.style.setProperty('--t-text-xs',   f.xs);
  root.style.setProperty('--t-text-sm',   f.sm);
  root.style.setProperty('--t-text-base', f.base);
  root.style.setProperty('--t-text-lg',   f.lg);
  root.style.setProperty('--t-text-xl',   f.xl);
  root.style.setProperty('--t-text-2xl',  f['2xl']);

  // Font family
  root.style.setProperty('--t-font', theme.font.family);

  // Radius
  root.style.setProperty('--t-radius', theme.radius);
}

function loadGoogleFont(url: string) {
  const id = 'theme-font-link';
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== url) link.href = url;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const prevId = useRef<string>('');

  useEffect(() => {
    applyTheme(theme);
    if (theme.font.googleUrl) loadGoogleFont(theme.font.googleUrl);
    prevId.current = theme.id;
  }, [theme]);

  return <>{children}</>;
}
