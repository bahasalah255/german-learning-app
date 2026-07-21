import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GradientFAB } from '../components/ui';
import { speakGerman, stopSpeech } from '../utils/speech';
import { refreshScheduledNotificationsIfEnabled } from '../utils/notifications';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const STORAGE_KEY = 'sentences';

export default function SentencesScreen() {
  const navigation = useNavigation();
  const { t, isRTL } = useLanguage();
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const [sentences, setSentences] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);

  const loadSentences = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      setSentences(stored ? JSON.parse(stored) : []);
    } catch {
      setSentences([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback((text) => setSearch(text), []);

  useFocusEffect(useCallback(() => {
    loadSentences();
    return () => { stopSpeech(); setPlayingId(null); };
  }, [loadSentences]));

  const handleSpeak = (id, text) => {
    if (playingId === id) {
      stopSpeech();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    speakGerman(text, {
      onDone: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  const handleDelete = (item) => {
    Alert.alert(
      t('sentences.deleteTitle'),
      t('sentences.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = sentences.filter((s) => s.id !== item.id);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              setSentences(updated);
              await refreshScheduledNotificationsIfEnabled();
            } catch {
              Alert.alert(t('common.error'), t('sentences.errorDelete'));
            }
          },
        },
      ]
    );
  };

  const filteredSentences = sentences.filter((s) => {
    const q = search.trim().toLowerCase();
    return !q || s.sentence.toLowerCase().includes(q) || s.translation.toLowerCase().includes(q);
  });

  const styles = useMemo(() => getStyles(c, isRTL, isDark), [c, isRTL, isDark]);

  const renderEmpty = () => {
    if (loading) return null;
    const isSearching = search.trim();
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons
            name={isSearching ? 'search-outline' : 'chatbubbles-outline'}
            size={36}
            color={isSearching ? c.textMuted : c.accent}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isSearching ? t('sentences.noSentencesFound') : t('sentences.noSentencesYet')}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isSearching ? t('sentences.tryDifferent') : t('sentences.tapToSave')}
        </Text>
      </View>
    );
  };

  const sentenceCount = sentences.length;

  const renderItem = ({ item }) => {
    const isPlaying = playingId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View />
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Ionicons name="trash-outline" size={18} color={c.error} />
          </TouchableOpacity>
        </View>

        <Text style={styles.germanText}>{item.sentence}</Text>

        <View style={styles.divider} />

        <Text style={styles.translationText}>{item.translation}</Text>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.listenBtn, isPlaying && styles.listenBtnActive]}
            onPress={() => handleSpeak(item.id, item.sentence)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
              size={14}
              color={isPlaying ? '#FFFFFF' : c.secondary}
            />
            <Text style={[styles.listenText, isPlaying && styles.listenTextActive]}>
              {isPlaying ? t('sentences.playing') : t('sentences.listen')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.practiceBtn}
            onPress={() => navigation.navigate('SpeechPractice', { targetText: item.sentence })}
            activeOpacity={0.7}
          >
            <Ionicons name="mic-outline" size={14} color={c.accent} />
            <Text style={styles.practiceText}>
              {t('sentences.practice')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />

      <View style={styles.staticHeader} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={c.primary === '#818CF8' ? ['#9D174D', '#5B21B6', '#4338CA'] : ['#EC4899', '#8B5CF6', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerInnerRow}>
            <View style={styles.bannerLeft}>
              <Text style={[styles.bannerEyebrow, isRTL && { textAlign: 'right' }]}>
                {t('sentences.bannerEyebrow')}
              </Text>
              <Text style={[styles.bannerTitle, isRTL && { textAlign: 'right' }]}>
                {t('sentences.title')}
              </Text>
              <Text style={[styles.bannerSubtitle, isRTL && { textAlign: 'right' }]}>
                {sentenceCount > 0
                  ? t('sentences.sentencesSaved', { n: sentenceCount, s: sentenceCount === 1 ? '' : 's' })
                  : t('sentences.learnInContext')}
              </Text>
            </View>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="chatbubbles-outline" size={38} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={c.textSecondary} />
          <TextInput
            style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
            placeholder={t('sentences.searchHint')}
            placeholderTextColor={c.textPlaceholder}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            onSubmitEditing={() => {}}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredSentences}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        />
      )}

      <GradientFAB onPress={() => navigation.navigate('AddSentence')} />
    </SafeAreaView>
  );
}

function getStyles(c, isRTL, isDark) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    loadingWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 110,
    },
    staticHeader: {
      paddingTop: 20,
      paddingHorizontal: 20,
      marginBottom: 4,
    },
    banner: {
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
    },
    bannerInnerRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bannerLeft: {
      flex: 1,
    },
    bannerEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.7)',
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    bannerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    bannerSubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.82)',
      fontWeight: '500',
    },
    bannerIconWrap: {
      marginLeft: isRTL ? 0 : 12,
      marginRight: isRTL ? 12 : 0,
      opacity: 0.9,
    },
    searchWrapper: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: c.textPrimary,
      padding: 0,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    cardTopRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    germanText: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      lineHeight: 25,
      marginBottom: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginBottom: 12,
    },
    translationText: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 21,
      marginBottom: 14,
      textAlign: isRTL ? 'right' : 'left',
    },
    cardActions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    practiceBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(236, 72, 153, 0.15)' : '#FDF2F8',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    practiceText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.accent,
    },
    listenBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    listenBtnActive: {
      backgroundColor: c.secondary,
    },
    listenText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.secondary,
    },
    listenTextActive: {
      color: '#FFFFFF',
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 56,
      paddingHorizontal: 32,
    },
    emptyIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: c.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
  });
}
