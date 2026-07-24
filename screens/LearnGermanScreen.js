import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const RESOURCES = [
  {
    id: 'easy-german-yt',
    category: 'youtube',
    level: 'intermediate',
    name: 'Easy German',
    description: 'Street interviews, slow German videos, and subtitles that help beginners move into real conversations.',
    url: 'https://www.youtube.com/channel/UCbxb2fqe9oNgglAoYqsYOtQ',
  },
  {
    id: 'anja-yt',
    category: 'youtube',
    level: 'beginner',
    name: 'Learn German with Anja',
    description: 'Clear explanations, beginner-friendly lessons, and practical grammar breakdowns.',
    url: 'https://www.youtube.com/c/LearnGermanwithAnja',
  },
  {
    id: 'dw-yt',
    category: 'youtube',
    level: 'beginner',
    name: 'DW Deutsch lernen',
    description: 'Structured lessons, listening practice, and everyday language support from Deutsche Welle.',
    url: 'https://www.youtube.com/@dwdeutschlernen',
  },
  {
    id: 'easy-german-ig',
    category: 'instagram',
    level: 'intermediate',
    name: 'Easy German',
    description: 'Daily expressions, pronunciation clips, and short reels that feel like real life.',
    url: 'https://www.instagram.com/easygermanvideos/',
  },
  {
    id: 'anja-ig',
    category: 'instagram',
    level: 'beginner',
    name: 'Learn German with Anja',
    description: 'Quick grammar tips, vocabulary reminders, and simple lessons you can revisit every day.',
    url: 'https://www.instagram.com/learngermanwithanja/',
  },
  {
    id: 'dw-ig',
    category: 'instagram',
    level: 'beginner',
    name: 'DW Deutsch lernen',
    description: 'Vocabulary, grammar tips, and short learning posts from Deutsche Welle.',
    url: 'https://www.instagram.com/dw_deutschlernen/',
  },
];

function openResource(url) {
  Linking.openURL(url).catch(() => {});
}

function ResourceCard({ resource, actionLabel, c, styles, isRTL }) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardTopRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={[styles.platformPill, isRTL && { flexDirection: 'row-reverse' }]}>
          <Ionicons
            name={resource.category === 'youtube' ? 'logo-youtube' : 'logo-instagram'}
            size={14}
            color="#FFFFFF"
          />
          <Text style={styles.platformText}>
            {resource.category === 'youtube' ? 'YouTube' : 'Instagram'}
          </Text>
        </View>

        <View style={styles.levelPill}>
          <Text style={styles.levelText}>{resource.level}</Text>
        </View>
      </View>

      <Text style={[styles.cardTitle, isRTL && { textAlign: 'right' }]}>{resource.name}</Text>
      <Text style={[styles.cardDescription, isRTL && { textAlign: 'right' }]}>{resource.description}</Text>

      <TouchableOpacity
        style={[styles.actionButton, isRTL && { flexDirection: 'row-reverse' }]}
        onPress={() => openResource(resource.url)}
        activeOpacity={0.85}
      >
        <Text style={styles.actionButtonText}>{actionLabel}</Text>
        <Ionicons name="open-outline" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

export default function LearnGermanScreen() {
  const { t, isRTL } = useLanguage();
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');

  const levelOptions = [
    { id: 'all', label: t('common.all') },
    { id: 'beginner', label: t('learnGerman.filters.beginner') },
    { id: 'intermediate', label: t('learnGerman.filters.intermediate') },
    { id: 'advanced', label: t('learnGerman.filters.advanced') },
  ];

  const filteredResources = useMemo(() => {
    const query = search.trim().toLowerCase();

    return RESOURCES.filter((resource) => {
      const matchesLevel = selectedLevel === 'all' || resource.level === selectedLevel;
      const matchesQuery = !query
        || resource.name.toLowerCase().includes(query)
        || resource.description.toLowerCase().includes(query)
        || resource.category.toLowerCase().includes(query);

      return matchesLevel && matchesQuery;
    });
  }, [search, selectedLevel]);

  const youtubeResources = filteredResources.filter((resource) => resource.category === 'youtube');
  const instagramResources = filteredResources.filter((resource) => resource.category === 'instagram');

  const styles = useMemo(() => getStyles(c, isRTL, isDark), [c, isRTL, isDark]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1E40AF', '#2563EB', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={[styles.heroEyebrow, isRTL && { textAlign: 'right' }]}>
            {t('learnGerman.title')}
          </Text>
          <Text style={[styles.heroTitle, isRTL && { textAlign: 'right' }]}>
            {t('learnGerman.subtitle')}
          </Text>

          <View style={[styles.heroStats, isRTL && { flexDirection: 'row-reverse' }]}> 
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{youtubeResources.length}</Text>
              <Text style={styles.heroStatLabel}>{t('learnGerman.youtubeChannels')}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{instagramResources.length}</Text>
              <Text style={styles.heroStatLabel}>{t('learnGerman.instagramAccounts')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.searchWrap}>
          <View style={[styles.searchBar, isRTL && { flexDirection: 'row-reverse' }]}> 
            <Ionicons name="search" size={18} color={c.textSecondary} />
            <TextInput
              style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
              value={search}
              onChangeText={setSearch}
              placeholder={t('learnGerman.searchHint')}
              placeholderTextColor={c.textPlaceholder}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.75}>
                <Ionicons name="close-circle" size={20} color={c.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            style={isRTL && { flexDirection: 'row-reverse' }}
          >
            {levelOptions.map((option) => {
              const active = selectedLevel === option.id;

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setSelectedLevel(option.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
            {t('learnGerman.youtubeChannels')}
          </Text>
          <Text style={styles.sectionCount}>{youtubeResources.length}</Text>
        </View>

        {youtubeResources.length > 0 ? (
          youtubeResources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              actionLabel={t('learnGerman.openYouTube')}
              c={c}
              styles={styles}
              isRTL={isRTL}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="videocam-outline" size={28} color={c.textMuted} />
            <Text style={styles.emptyText}>{t('learnGerman.noResults')}</Text>
          </View>
        )}

        <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
            {t('learnGerman.instagramAccounts')}
          </Text>
          <Text style={styles.sectionCount}>{instagramResources.length}</Text>
        </View>

        {instagramResources.length > 0 ? (
          instagramResources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              actionLabel={t('learnGerman.openInstagram')}
              c={c}
              styles={styles}
              isRTL={isRTL}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="logo-instagram" size={28} color={c.textMuted} />
            <Text style={styles.emptyText}>{t('learnGerman.noResults')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(c, isRTL, isDark) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 32,
    },
    hero: {
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.35 : 0.2,
      shadowRadius: 16,
      elevation: 5,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      color: 'rgba(255,255,255,0.75)',
      letterSpacing: 1.6,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    heroTitle: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: 16,
    },
    heroStats: {
      flexDirection: 'row',
      gap: 12,
    },
    heroStat: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    heroStatValue: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 2,
    },
    heroStatLabel: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 12,
      fontWeight: '600',
    },
    searchWrap: {
      marginBottom: 8,
    },
    searchBar: {
      backgroundColor: c.card,
      borderRadius: 18,
      paddingHorizontal: 16,
      height: 52,
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      borderWidth: 1.5,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 6,
      elevation: 2,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: c.textPrimary,
    },
    filters: {
      paddingVertical: 4,
      gap: 10,
      flexDirection: isRTL ? 'row-reverse' : 'row',
    },
    filterChip: {
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: c.cardAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    filterChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    filterText: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textSecondary,
    },
    filterTextActive: {
      color: '#FFFFFF',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: c.textPrimary,
    },
    sectionCount: {
      fontSize: 13,
      fontWeight: '700',
      color: c.primary,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 20,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: isDark ? '#000' : '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    platformPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: c.primary,
    },
    platformText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    levelPill: {
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: c.cardAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    levelText: {
      color: c.secondary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: c.textPrimary,
      marginBottom: 6,
    },
    cardDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
      marginBottom: 16,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 14,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    emptyState: {
      backgroundColor: c.card,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 28,
      paddingHorizontal: 20,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
      gap: 10,
    },
    emptyText: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}