import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../utils/ThemeContext';

// Full-width gradient save/action button
export function GradientButton({
  onPress,
  disabled,
  label,
  loading = false,
  loadingLabel = 'Saving…',
  icon,
  style,
  colors,
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const btnColors = colors || [c.primary, c.secondary];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[s.buttonWrap, style]}
    >
      <LinearGradient
        colors={disabled ? [c.border, c.border] : btnColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.button, disabled && { opacity: 0.6 }]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
        ) : icon ? (
          <Ionicons name={icon} size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
        ) : null}
        <Text style={s.buttonText}>{loading ? loadingLabel : label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Outlined Secondary Button
export function SecondaryButton({ onPress, label, icon, style, disabled }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        s.secondaryBtn,
        { borderColor: c.border, backgroundColor: c.card },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={c.textPrimary} style={{ marginRight: 6 }} />}
      <Text style={[s.secondaryBtnText, { color: c.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Circular gradient floating action button — positioned absolute bottom-right
export function GradientFAB({ onPress, icon = 'add' }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.fabWrap, { bottom: insets.bottom + 88 }]}
    >
      <LinearGradient
        colors={[c.primary, c.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.fab}
      >
        <Ionicons name={icon} size={28} color="#FFFFFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Skeleton loader line
export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.shimmer,
        },
        style,
      ]}
    />
  );
}

// Modern Empty State component
export function EmptyState({ icon = 'sparkles-outline', title, subtitle, actionLabel, onAction }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={s.emptyWrap}>
      <View style={[s.emptyIconCircle, { backgroundColor: c.cardAlt }]}>
        <Ionicons name={icon} size={36} color={c.primary} />
      </View>
      <Text style={[s.emptyTitle, { color: c.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[s.emptySubtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <GradientButton label={actionLabel} onPress={onAction} style={{ marginTop: 16, minWidth: 160 }} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  buttonWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  fabWrap: {
    position: 'absolute',
    right: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 99,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
