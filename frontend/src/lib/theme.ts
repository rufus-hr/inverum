// ---------------------------------------------------------------------------
// Theme system — defines all visual tokens for the application.
// Cascade order: user preference → organization → tenant → built-in default.
// ---------------------------------------------------------------------------

export interface AppTheme {
  id: string;
  name: string;

  font: {
    family: string;       // CSS font-family value, e.g. "'Inter', sans-serif"
    googleUrl?: string;   // Google Fonts URL for dynamic loading
  };

  // 6 semantic size steps — used for text throughout the app.
  // Components reference these via --t-text-{size} CSS vars.
  fontSize: {
    xs:   string; // labels, badges, captions        ~11px
    sm:   string; // secondary text, descriptions    ~13px
    base: string; // body, form labels               ~14px
    lg:   string; // section headers, nav items      ~16px
    xl:   string; // page titles, card headers       ~20px
    '2xl': string; // dashboard metrics, hero        ~24px
  };

  colors: {
    // Brand
    primary:      string; // buttons, links, active states
    primaryHover: string;
    primaryFg:    string; // text on primary-colored backgrounds

    // Layout
    bg:           string; // page / app background
    surface:      string; // card, panel, dropdown background
    surfaceHover: string;

    // Borders
    border:       string; // default border
    borderStrong: string; // emphasized border (focus rings, dividers)

    // Text
    text:         string; // primary body text
    textMuted:    string; // secondary text
    textSubtle:   string; // placeholder, disabled text

    // Semantic states
    danger:      string;
    dangerBg:    string;
    warning:     string;
    warningBg:   string;
    success:     string;
    successBg:   string;
    info:        string;
    infoBg:      string;
  };

  radius: string; // base border-radius, e.g. '6px'
}

// ---------------------------------------------------------------------------
// Built-in themes
// ---------------------------------------------------------------------------

export const THEME_LIGHT: AppTheme = {
  id: 'light',
  name: 'Light',
  font: {
    family: "'Inter', system-ui, sans-serif",
    googleUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
  fontSize: {
    xs:   '0.6875rem', // 11px
    sm:   '0.8125rem', // 13px
    base: '0.875rem',  // 14px
    lg:   '1rem',      // 16px
    xl:   '1.25rem',   // 20px
    '2xl': '1.5rem',   // 24px
  },
  colors: {
    primary:      '#2563eb',
    primaryHover: '#1d4ed8',
    primaryFg:    '#ffffff',

    bg:           '#F8F9FA',
    surface:      '#ffffff',
    surfaceHover: '#f8fafc',

    border:       '#e2e8f0',
    borderStrong: '#cbd5e1',

    text:         '#0f172a',
    textMuted:    '#475569',
    textSubtle:   '#94a3b8',

    danger:      '#dc2626',
    dangerBg:    '#fef2f2',
    warning:     '#d97706',
    warningBg:   '#fffbeb',
    success:     '#16a34a',
    successBg:   '#f0fdf4',
    info:        '#0284c7',
    infoBg:      '#f0f9ff',
  },
  radius: '6px',
};

export const THEME_DARK: AppTheme = {
  id: 'dark',
  name: 'Dark',
  font: {
    family: "'Inter', system-ui, sans-serif",
    googleUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
  fontSize: {
    xs:   '0.6875rem',
    sm:   '0.8125rem',
    base: '0.875rem',
    lg:   '1rem',
    xl:   '1.25rem',
    '2xl': '1.5rem',
  },
  colors: {
    primary:      '#3b82f6',
    primaryHover: '#2563eb',
    primaryFg:    '#ffffff',

    bg:           '#0f172a',
    surface:      '#1e293b',
    surfaceHover: '#263348',

    border:       '#334155',
    borderStrong: '#475569',

    text:         '#f1f5f9',
    textMuted:    '#94a3b8',
    textSubtle:   '#64748b',

    danger:      '#f87171',
    dangerBg:    '#450a0a',
    warning:     '#fbbf24',
    warningBg:   '#451a03',
    success:     '#4ade80',
    successBg:   '#052e16',
    info:        '#38bdf8',
    infoBg:      '#082f49',
  },
  radius: '6px',
};

export const THEME_MANIJAK: AppTheme = {
  id: 'manijak',
  name: 'Manijak',
  font: {
    family: "'Nunito', system-ui, sans-serif",
    googleUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap',
  },
  fontSize: {
    xs:   '0.75rem',
    sm:   '0.875rem',
    base: '1rem',
    lg:   '1.125rem',
    xl:   '1.375rem',
    '2xl': '1.75rem',
  },
  colors: {
    primary:      '#00cc44',
    primaryHover: '#00aa33',
    primaryFg:    '#ffffff',

    bg:           '#ff69b4',
    surface:      '#ff85c2',
    surfaceHover: '#ff9dcd',

    border:       '#e0408a',
    borderStrong: '#c42f70',

    text:         '#1a0010',
    textMuted:    '#6b0035',
    textSubtle:   '#a0005a',

    danger:      '#ff2200',
    dangerBg:    '#ffe0dc',
    warning:     '#ff8800',
    warningBg:   '#fff0dc',
    success:     '#00cc44',
    successBg:   '#dcffe8',
    info:        '#ff00ff',
    infoBg:      '#ffe0ff',
  },
  radius: '16px',
};

export const BUILT_IN_THEMES: AppTheme[] = [THEME_LIGHT, THEME_DARK, THEME_MANIJAK];

export function getThemeById(id: string): AppTheme {
  return BUILT_IN_THEMES.find((t) => t.id === id) ?? THEME_LIGHT;
}
