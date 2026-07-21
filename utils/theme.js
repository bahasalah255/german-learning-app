/**
 * Centralized theme definitions for the Lerne app.
 *
 * Usage:
 *   import { useTheme } from './ThemeContext';
 *   const { theme, isDark } = useTheme();
 *   const styles = makeStyles(theme);
 */

// ─── Shared palette ───────────────────────────────────────────────────────────

export const palette = {
  // Brand
  primary:   '#6366F1',
  secondary: '#8B5CF6',
  accent:    '#EC4899',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#3B82F6',

  // Always-white text on gradient buttons, etc.
  onPrimary: '#FFFFFF',

  // Gradient presets (used by LinearGradient)
  gradientPurple: ['#6366F1', '#8B5CF6', '#EC4899'],
  gradientBlue:   ['#3B82F6', '#6366F1'],
  gradientGreen:  ['#059669', '#10B981'],
  gradientOrange: ['#F97316', '#F59E0B'],
  gradientHero:   ['#7B61FF', '#C850C0', '#FF6B9D'],
};

// ─── Light Theme ─────────────────────────────────────────────────────────────

export const lightTheme = {
  dark: false,

  colors: {
    // Backgrounds
    background:    '#F4F6FB',
    surface:       '#FFFFFF',
    card:          '#FFFFFF',
    cardAlt:       '#F9FAFB',
    overlay:       'rgba(0,0,0,0.35)',

    // Borders
    border:        '#E5E7EB',
    borderLight:   '#F0F0F8',

    // Text
    textPrimary:   '#1A1A2E',
    textSecondary: '#6B7280',
    textMuted:     '#9CA3AF',
    textPlaceholder: '#C0C0CC',

    // Brand colours (same in both themes)
    primary:   palette.primary,
    secondary: palette.secondary,
    accent:    palette.accent,
    success:   palette.success,
    warning:   palette.warning,
    error:     palette.error,
    info:      palette.info,
    onPrimary: palette.onPrimary,

    // Status bar
    statusBar: 'dark',
    statusBarBg: '#F4F6FB',

    // Navigation bar
    navBackground:  '#FFFFFF',
    navBorder:      'rgba(0,0,0,0.06)',
    navActive:      '#6C63FF',
    navInactive:    '#9CA3AF',
    navCenterBorder:'#FFFFFF',

    // Inputs
    inputBg:        '#FFFFFF',
    inputBorder:    '#E5E7EB',
    inputText:      '#1A1A2E',

    // Switches
    switchTrackOn:  '#4DBFA0',
    switchTrackOff: '#E0E0E8',
    switchThumb:    '#FFFFFF',

    // Segmented control
    segmentedBg:      '#F0F0F8',
    segmentActiveBg:  '#FFFFFF',
    segmentText:      '#9090A0',
    segmentActiveText:'#1A1A2E',

    // Section label
    sectionLabel: '#9090A0',

    // Misc
    shimmer:     '#E5E7EB',
    shimmerDark: '#D1D5DB',
    heroText:    '#FFFFFF',
  },
};

// ─── Dark Theme ──────────────────────────────────────────────────────────────
// Inspired by Notion / GitHub Dark / Discord
// NOT pure black — uses a layered grey system

export const darkTheme = {
  dark: true,

  colors: {
    // Backgrounds
    background:    '#121212',
    surface:       '#1E1E1E',
    card:          '#252525',
    cardAlt:       '#2A2A2A',
    overlay:       'rgba(0,0,0,0.65)',

    // Borders
    border:        '#343434',
    borderLight:   '#2E2E2E',

    // Text
    textPrimary:   '#F3F4F6',
    textSecondary: '#B3B3B3',
    textMuted:     '#737373',
    textPlaceholder: '#5A5A5A',

    // Brand colours (adjusted for dark backgrounds)
    primary:   '#818CF8',  // slightly lighter indigo for dark bg
    secondary: '#A78BFA',
    accent:    '#F472B6',
    success:   '#4ADE80',
    warning:   '#FCD34D',
    error:     '#F87171',
    info:      '#60A5FA',
    onPrimary: '#FFFFFF',

    // Status bar
    statusBar: 'light',
    statusBarBg: '#121212',

    // Navigation bar
    navBackground:  '#1E1E1E',
    navBorder:      'rgba(255,255,255,0.06)',
    navActive:      '#818CF8',
    navInactive:    '#6B7280',
    navCenterBorder:'#252525',

    // Inputs
    inputBg:        '#252525',
    inputBorder:    '#343434',
    inputText:      '#F3F4F6',

    // Switches
    switchTrackOn:  '#4ADE80',
    switchTrackOff: '#404040',
    switchThumb:    '#FFFFFF',

    // Segmented control
    segmentedBg:      '#2A2A2A',
    segmentActiveBg:  '#363636',
    segmentText:      '#737373',
    segmentActiveText:'#F3F4F6',

    // Section label
    sectionLabel: '#737373',

    // Misc
    shimmer:     '#2A2A2A',
    shimmerDark: '#333333',
    heroText:    '#FFFFFF',
  },
};
