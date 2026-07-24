/**
 * Centralized theme definitions for the Lerne app.
 *
 * Design System: 2026 Duolingo/Headway/Apple aesthetic
 * Primary: #2563EB | Secondary: #3B82F6 | Accent: #60A5FA
 * Light BG: #F8FAFC | Dark BG: #0F172A
 */

export const palette = {
  // Brand
  primary:   '#2563EB',
  secondary: '#3B82F6',
  accent:    '#60A5FA',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#3B82F6',

  // Always-white text on gradient buttons, etc.
  onPrimary: '#FFFFFF',

  // Gradient presets (used by LinearGradient)
  gradientBlue:   ['#2563EB', '#3B82F6', '#60A5FA'],
  gradientPurple: ['#4F46E5', '#7C3AED', '#EC4899'],
  gradientGreen:  ['#16A34A', '#22C55E'],
  gradientOrange: ['#EA580C', '#F59E0B'],
  gradientHero:   ['#1E40AF', '#2563EB', '#3B82F6'],
};

// ─── Light Theme ─────────────────────────────────────────────────────────────

export const lightTheme = {
  dark: false,

  colors: {
    // Backgrounds
    background:    '#F8FAFC',
    surface:       '#FFFFFF',
    card:          '#FFFFFF',
    cardAlt:       '#F1F5F9',
    overlay:       'rgba(15, 23, 42, 0.4)',

    // Borders
    border:        '#E2E8F0',
    borderLight:   '#F1F5F9',

    // Text
    textPrimary:   '#0F172A',
    textSecondary: '#64748B',
    textMuted:     '#94A3B8',
    textPlaceholder: '#CBD5E1',

    // Brand colours
    primary:   '#2563EB',
    secondary: '#3B82F6',
    accent:    '#60A5FA',
    success:   '#22C55E',
    warning:   '#F59E0B',
    error:     '#EF4444',
    info:      '#3B82F6',
    onPrimary: '#FFFFFF',

    // Status bar
    statusBar: 'dark',
    statusBarBg: '#F8FAFC',

    // Navigation bar
    navBackground:  '#FFFFFF',
    navBorder:      '#E2E8F0',
    navActive:      '#2563EB',
    navInactive:    '#94A3B8',
    navCenterBorder:'#FFFFFF',

    // Inputs
    inputBg:        '#FFFFFF',
    inputBorder:    '#E2E8F0',
    inputText:      '#0F172A',

    // Switches
    switchTrackOn:  '#2563EB',
    switchTrackOff: '#E2E8F0',
    switchThumb:    '#FFFFFF',

    // Segmented control
    segmentedBg:      '#F1F5F9',
    segmentActiveBg:  '#FFFFFF',
    segmentText:      '#64748B',
    segmentActiveText:'#0F172A',

    // Section label
    sectionLabel: '#64748B',

    // Misc
    shimmer:     '#E2E8F0',
    shimmerDark: '#CBD5E1',
    heroText:    '#FFFFFF',
  },
};

// ─── Dark Theme ──────────────────────────────────────────────────────────────

export const darkTheme = {
  dark: true,

  colors: {
    // Backgrounds
    background:    '#0F172A',
    surface:       '#1E293B',
    card:          '#1E293B',
    cardAlt:       '#334155',
    overlay:       'rgba(0, 0, 0, 0.7)',

    // Borders
    border:        '#334155',
    borderLight:   '#1E293B',

    // Text
    textPrimary:   '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted:     '#64748B',
    textPlaceholder: '#475569',

    // Brand colours
    primary:   '#3B82F6',
    secondary: '#60A5FA',
    accent:    '#93C5FD',
    success:   '#4ADE80',
    warning:   '#FBBF24',
    error:     '#F87171',
    info:      '#60A5FA',
    onPrimary: '#FFFFFF',

    // Status bar
    statusBar: 'light',
    statusBarBg: '#0F172A',

    // Navigation bar
    navBackground:  '#1E293B',
    navBorder:      '#334155',
    navActive:      '#60A5FA',
    navInactive:    '#64748B',
    navCenterBorder:'#1E293B',

    // Inputs
    inputBg:        '#1E293B',
    inputBorder:    '#334155',
    inputText:      '#F8FAFC',

    // Switches
    switchTrackOn:  '#3B82F6',
    switchTrackOff: '#334155',
    switchThumb:    '#FFFFFF',

    // Segmented control
    segmentedBg:      '#334155',
    segmentActiveBg:  '#1E293B',
    segmentText:      '#94A3B8',
    segmentActiveText:'#F8FAFC',

    // Section label
    sectionLabel: '#94A3B8',

    // Misc
    shimmer:     '#334155',
    shimmerDark: '#475569',
    heroText:    '#FFFFFF',
  },
};
