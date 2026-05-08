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
    id: 'benjamin-yt',
    category: 'youtube',
    level: 'advanced',
    name: 'Benjamin - Der Deutschlehrer',
    description: 'Grammar-heavy lessons, vocabulary building, and deeper explanations for higher-level learners.',
    url: 'https://www.youtube.com/@BenjaminDerDeutschlehrer',
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
  {
    id: 'learn-german-language-ig',
    category: 'instagram',
    level: 'intermediate',
    name: 'learn.german.language',
    description: 'Bite-sized pronunciation practice, grammar reminders, and vocabulary reels.',
    url: 'https://www.instagram.com/learn.german.language/',
  },
];

function openResource(url) {
  Linking.openURL(url).catch(() => {});
}

function ResourceCard({ resource, actionLabel }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.platformPill}>
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

      <Text style={styles.cardTitle}>{resource.name}</Text>
      <Text style={styles.cardDescription}>{resource.description}</Text>

      <TouchableOpacity
        style={styles.actionButton}
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" translucent={false} backgroundColor="#0F172A" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#0F172A', '#1D4ED8', '#2563EB']}
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
            <Ionicons name="search" size={18} color="#7C8598" />
            <TextInput
              style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
              value={search}
              onChangeText={setSearch}
              placeholder={t('learnGerman.searchHint')}
              placeholderTextColor="#8C93A6"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.75}>
                <Ionicons name="close-circle" size={20} color="#9AA2B2" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
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

        <View style={styles.sectionHeader}>
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
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="videocam-outline" size={28} color="#A1A8B8" />
            <Text style={styles.emptyText}>{t('learnGerman.noResults')}</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
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
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="logo-instagram" size={28} color="#A1A8B8" />
            <Text style={styles.emptyText}>{t('learnGerman.noResults')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FC',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 5,
  },
  heroEyebrow: {
    fontSize: 12,
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
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
    fontWeight: '600',
  },
  searchWrap: {
    marginBottom: 8,
  },
  searchBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 54,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  filters: {
    paddingVertical: 4,
    gap: 10,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#E9EEF8',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#51607A',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#132238',
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#74829A',
    backgroundColor: '#E9EEF8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
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
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
  },
  platformText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  levelPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EEF2FF',
  },
  levelText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#132238',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5A6782',
    marginBottom: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 13,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 18,
    marginBottom: 12,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
});