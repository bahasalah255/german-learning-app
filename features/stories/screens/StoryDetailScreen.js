import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLanguage } from '../../../utils/LanguageContext';
import { getStoryById } from '../services/StoryService';

export default function StoryDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t, isRTL } = useLanguage();
  const [story, setStory] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const loaded = await getStoryById(route.params?.storyId);
      if (active) setStory(loaded);
    })();

    return () => {
      active = false;
    };
  }, [route.params?.storyId]);

  if (!story) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>{t('stories.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const previewParagraphs = Array.isArray(story.paragraphs) ? story.paragraphs : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, isRTL && { flexDirection: 'row-reverse' }]}> 
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={18} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t('stories.detailTitle')}</Text>
          <View style={styles.backBtnSpacer} />
        </View>

        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={[styles.heroRow, isRTL && { flexDirection: 'row-reverse' }]}> 
            <Image source={story.coverImageSource} style={styles.cover} />
            <View style={styles.heroMeta}>
              <Text style={styles.category}>{story.category}</Text>
              <Text style={styles.title}>{story.title}</Text>
              <Text style={styles.subtitle}>{story.subtitle}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <MetaBadge label={`${story.level}`} icon="school-outline" />
            <MetaBadge label={`${story.readingTime} min`} icon="time-outline" />
            <MetaBadge label={`${story.wordCount} words`} icon="book-outline" />
            <MetaBadge label={`+${story.xp} XP`} icon="star-outline" />
          </View>
        </LinearGradient>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{t('stories.aboutStory')}</Text>
          <Text style={[styles.summary, isRTL && { textAlign: 'right' }]}>{story.summary}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{t('stories.previewTitle')}</Text>
          {previewParagraphs.slice(0, 1).map((paragraph) => (
            <View key={paragraph.paragraph_id} style={styles.previewBox}>
              <Text style={styles.previewLabel}>{t('stories.paragraph')} {paragraph.order}</Text>
              <Text style={[styles.previewText, isRTL && { textAlign: 'right' }]}>{paragraph.german_text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('StoryReader', { storyId: story.id })}
        >
          <Text style={styles.primaryButtonText}>{t('stories.startReading')}</Text>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaBadge({ label, icon }) {
  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={13} color="#FFFFFF" />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#1A1A2E',
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backBtnSpacer: {
    width: 36,
    height: 36,
  },
  hero: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  cover: {
    width: 88,
    height: 118,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroMeta: {
    flex: 1,
  },
  category: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  summary: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
  },
  previewBox: {
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  previewLabel: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  previewText: {
    color: '#1F2937',
    fontSize: 14,
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 18,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});