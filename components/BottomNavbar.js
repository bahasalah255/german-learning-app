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
  { name: 'Quiz',      icon: 'star',       iconOutline: 'star-outline',       isCenter: true },
  { name: 'Sentences', icon: 'chatbubble', iconOutline: 'chatbubble-outline' },
  { name: 'Planner',   icon: 'calendar',   iconOutline: 'calendar-outline'  },
  { name: 'Settings',  icon: 'settings',   iconOutline: 'settings-outline'  },
];

function CenterButton({ onPress, borderColor }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.centerTouchable}>
      <LinearGradient
        colors={['#A855F7', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.centerGradient, { borderColor }]}
      >
        <Ionicons name="star" size={28} color="#FFFFFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function BottomNavbar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { theme } = useTheme();
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
    borderTopWidth:  0.5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: theme.dark ? 0.4 : 0.08,
    shadowRadius: 10,
    elevation: 5,
  }), [c, theme.dark]);

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

          const iconColor = focused ? c.navActive : c.navInactive;

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={makeOnPress(route, focused)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={focused ? tab.icon : tab.iconOutline}
                size={24}
                color={iconColor}
              />
              <Text style={[styles.label, { color: iconColor }]}>
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
    top: -32,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  centerTouchable: {
    ...Platform.select({
      ios: {
        shadowColor: '#A855F7',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
      },
      android: { elevation: 14 },
    }),
  },
  centerGradient: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  navbar: {
    flexDirection: 'row',
    height: 72,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 2,
    minHeight: 72,
    marginRight: 8,
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
    height: 13,
  },
});
