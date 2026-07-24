import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const TABS = [
  { name: 'Home',      icon: 'home',       iconOutline: 'home-outline'      },
  { name: 'Words',     icon: 'book',       iconOutline: 'book-outline'      },
  { name: 'Quiz',      icon: 'sparkles',   iconOutline: 'sparkles-outline', isCenter: true },
  { name: 'Sentences', icon: 'chatbubbles',iconOutline: 'chatbubbles-outline'},
  { name: 'Planner',   icon: 'calendar',   iconOutline: 'calendar-outline'  },
  { name: 'Settings',  icon: 'settings',   iconOutline: 'settings-outline'  },
];

function CenterButton({ onPress, borderColor }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.centerTouchable}>
      <LinearGradient
        colors={['#2563EB', '#3B82F6', '#60A5FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.centerGradient, { borderColor }]}
      >
        <Ionicons name="sparkles" size={26} color="#FFFFFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function BottomNavbar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const NAV_LABELS = {
    Home:      t('nav.home'),
    Words:     t('nav.words'),
    Quiz:      '',
    Sentences: t('nav.sentences'),
    Planner:   t('nav.planner'),
    Settings:  t('nav.settings'),
  };

  const makeOnPress = (route, focused) => () => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const quizTab   = TABS.find(t => t.isCenter);
  const quizRoute = state.routes.find(r => r.name === quizTab.name);
  const quizFocused = state.routes[state.index].name === quizTab.name;

  const containerStyle = useMemo(() => ({
    backgroundColor: c.navBackground,
    borderTopColor:  c.navBorder,
    borderTopWidth:  1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: isDark ? '#000' : '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: isDark ? 0.5 : 0.06,
    shadowRadius: 12,
    elevation: 10,
  }), [c, isDark]);

  return (
    <View style={[containerStyle, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.centerWrapper} pointerEvents="box-none">
        <CenterButton
          onPress={makeOnPress(quizRoute, quizFocused)}
          borderColor={c.navCenterBorder}
        />
      </View>

      <View style={styles.navbar}>
        {TABS.map((tab) => {
          const route   = state.routes.find(r => r.name === tab.name);
          const focused = state.routes[state.index].name === tab.name;

          if (tab.isCenter) {
            return <View key={tab.name} style={styles.centerSlot} />;
          }

          const iconColor = focused ? c.primary : c.navInactive;

          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, focused && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF' }]}
              onPress={makeOnPress(route, focused)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={focused ? tab.icon : tab.iconOutline}
                size={22}
                color={iconColor}
              />
              <Text style={[styles.label, { color: iconColor, fontWeight: focused ? '700' : '500' }]}>
                {NAV_LABELS[tab.name] ?? tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerWrapper: {
    position: 'absolute',
    top: -28,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  centerTouchable: {
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: { elevation: 12 },
    }),
  },
  centerGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  navbar: {
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 14,
    gap: 2,
    marginHorizontal: 2,
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.1,
  },
});
