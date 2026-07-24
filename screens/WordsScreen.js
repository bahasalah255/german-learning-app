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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FILTER_OPTIONS } from '../constants/articleColors';
import { GradientFAB } from '../components/ui';
import { speakGerman, stopSpeech } from '../utils/speech';
import { refreshScheduledNotificationsIfEnabled } from '../utils/notifications';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import {
  isPlural,
  getArticleLabel,
  getTTSString,
  getGenderName,
  getWordIcon,
  getArticleStyle,
} from '../utils/articleHelpers';

const STORAGE_KEY = 'words';
const PLURAL_FILTER = 'diePlural';

export default function WordsScreen() {
  const navigation = useNavigation();
  const { t, isRTL } = useLanguage();
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const [words, setWords] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const [detailWord, setDetailWord] = useState(null);

  const loadWords = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      setWords(stored ? JSON.parse(stored) : []);
    } catch {
      setWords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback((text) => setSearch(text), []);

  useFocusEffect(useCallback(() => {
    loadWords();
    return () => { stopSpeech(); setPlayingId(null); };
  }, [loadWords]));

  const handleDelete = (item) => {
    Alert.alert(
      t('words.deleteTitle'),
      t('words.deleteMsg', { word: item.word }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = words.filter((w) => w.id !== item.id);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              setWords(updated);
              await refreshScheduledNotificationsIfEnabled();
            } catch {
              Alert.alert(t('common.error'), t('words.errorDelete'));
            }
          },
        },
      ]
    );
  };

  const handleSpeak = (id, item) => {
    if (playingId === id) {
      stopSpeech();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    speakGerman(getTTSString(item), {
      onDone: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  const filteredWords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return words.filter((w) => {
      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === PLURAL_FILTER ? isPlural(w) : w.article === activeFilter);
      return (
        matchesFilter &&
        (!q || w.word.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q))
      );
    });
  }, [words, activeFilter, search]);

  const styles = useMemo(() => getStyles(c, isRTL, isDark), [c, isRTL, isDark]);

  const renderEmpty = () => {
    if (loading) return null;
    const isSearching = search.trim() || activeFilter !== 'All';
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons
            name={isSearching ? 'search-outline' : 'library-outline'}
            size={36}
            color={isSearching ? c.textMuted : c.primary}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isSearching ? t('words.noWordsFound') : t('words.noWordsYet')}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isSearching ? t('words.tryDifferent') : t('words.tapToAdd')}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const artColors = getArticleStyle(item, isDark);
    const isPlaying = playingId === item.id;
    const pluralWord = isPlural(item);
    return (
      <View style={styles.wordCard}>
        <View style={[styles.wordIconCircle, { backgroundColor: artColors.bg }]}>
          <Ionicons name={getWordIcon(item)} size={20} color={artColors.text} />
        </View>

        <TouchableOpacity
          style={styles.wordInfo}
          onPress={() => setDetailWord(item)}
          activeOpacity={0.7}
        >
          <View style={styles.wordNameRow}>
            {pluralWord ? (
              <View style={styles.articlePillRow}>
                <View style={[styles.articlePill, { backgroundColor: artColors.bg }]}>
                  <Text style={[styles.articlePillText, { color: artColors.text }]}>die</Text>
                </View>
                <View style={[styles.pluralTag, { backgroundColor: artColors.bg }]}>
                  <Text style={[styles.pluralTagText, { color: artColors.text }]}>Plural</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.articlePill, { backgroundColor: artColors.bg }]}>
                <Text style={[styles.articlePillText, { color: artColors.text }]}>{item.article}</Text>
              </View>
            )}
            <Text style={styles.wordText}>{item.word}</Text>
          </View>
          <Text style={[styles.translationText, isRTL && { textAlign: 'right' }]}>{item.translation}</Text>
        </TouchableOpacity>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.listenIconBtn, isPlaying && { backgroundColor: c.primary }]}
            onPress={() => handleSpeak(item.id, item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Ionicons
              name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
              size={20}
              color={isPlaying ? '#FFFFFF' : c.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Ionicons name="trash-outline" size={18} color={c.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const wordCount = words.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />

      <View style={styles.staticHeader} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={['#1E40AF', '#2563EB', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerInnerRow}>
            <View style={styles.bannerLeft}>
              <Text style={[styles.bannerEyebrow, isRTL && { textAlign: 'right' }]}>
                {t('words.bannerEyebrow')}
              </Text>
              <Text style={[styles.bannerTitle, isRTL && { textAlign: 'right' }]}>
                {t('words.title')}
              </Text>
              <Text style={[styles.bannerSubtitle, isRTL && { textAlign: 'right' }]}>
                {wordCount > 0
                  ? t('words.wordsSaved', { n: wordCount, s: wordCount === 1 ? '' : 's' })
                  : t('words.buildVocab')}
              </Text>
            </View>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="book" size={38} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={20} color={c.textSecondary} />
          <TextInput
            style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
            placeholder={t('words.searchHint')}
            placeholderTextColor={c.textPlaceholder}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          {[...FILTER_OPTIONS, PLURAL_FILTER].map((opt) => {
            const isActive = opt === activeFilter;
            const isPluralChip = opt === PLURAL_FILTER;
            const colorKey = isPluralChip ? 'plural' : opt;
            const artColors = opt !== 'All' ? getArticleStyle(colorKey, isDark) : null;
            const chipLabel = opt === 'All'
              ? t('common.all')
              : isPluralChip
                ? `die (${t('words.pluralLabel')})`
                : opt;

            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.filterChip,
                  isActive && (artColors ? { backgroundColor: artColors.bg } : styles.filterChipActiveAll),
                ]}
                onPress={() => setActiveFilter(opt)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && (artColors ? { color: artColors.text } : styles.filterChipTextAll),
                  ]}
                >
                  {chipLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredWords}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      <GradientFAB onPress={() => navigation.navigate('AddWord')} />

      {/* ── Word Detail Modal ─────────────────────────────── */}
      <Modal
        visible={Boolean(detailWord)}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailWord(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailWord(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {detailWord && (() => {
              const artColors = getArticleStyle(detailWord, isDark);
              const pluralWord = isPlural(detailWord);
              const genderName = getGenderName(detailWord);
              return (
                <>
                  <View style={[styles.modalHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={[styles.modalIconCircle, { backgroundColor: artColors.bg }]}>
                      <Ionicons name={getWordIcon(detailWord)} size={24} color={artColors.text} />
                    </View>
                    <View style={styles.modalHeaderText}>
                      <Text style={styles.modalWordTitle}>{detailWord.word}</Text>
                      {detailWord.translation ? (
                        <Text style={styles.modalTranslation}>{detailWord.translation}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={[styles.modalMetaRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={styles.modalMetaItem}>
                      <Text style={styles.modalMetaLabel}>Article</Text>
                      {pluralWord ? (
                        <View style={styles.articlePillRow}>
                          <View style={[styles.articlePill, { backgroundColor: artColors.bg }]}>
                            <Text style={[styles.articlePillText, { color: artColors.text }]}>die</Text>
                          </View>
                          <View style={[styles.pluralTag, { backgroundColor: artColors.bg }]}>
                            <Text style={[styles.pluralTagText, { color: artColors.text }]}>Plural</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={[styles.articlePill, { backgroundColor: artColors.bg }]}>
                          <Text style={[styles.articlePillText, { color: artColors.text }]}>
                            {detailWord.article}
                          </Text>
                        </View>
                      )}
                    </View>
                    {genderName ? (
                      <View style={styles.modalMetaItem}>
                        <Text style={styles.modalMetaLabel}>Gender</Text>
                        <Text style={[styles.modalMetaValue, { color: artColors.text }]}>{genderName}</Text>
                      </View>
                    ) : null}
                  </View>

                  {detailWord.example ? (
                    <View style={styles.modalExampleBox}>
                      <Text style={styles.modalMetaLabel}>Example</Text>
                      <Text style={styles.modalExampleText}>{detailWord.example}</Text>
                    </View>
                  ) : null}

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalActionBtn}
                      onPress={() => handleSpeak(detailWord.id, detailWord)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="volume-medium-outline" size={20} color={c.primary} />
                      <Text style={[styles.modalActionLabel, { color: c.primary }]}>Listen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, styles.modalActionBtnDelete]}
                      onPress={() => { setDetailWord(null); handleDelete(detailWord); }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={20} color={c.error} />
                      <Text style={[styles.modalActionLabel, { color: c.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDetailWord(null)} activeOpacity={0.8}>
                    <Text style={styles.modalCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
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
      paddingTop: 16,
      paddingHorizontal: 20,
      marginBottom: 4,
    },
    banner: {
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#2563EB',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 5,
    },
    bannerInnerRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bannerLeft: { flex: 1 },
    bannerEyebrow: {
      fontSize: 10,
      fontWeight: '800',
      color: 'rgba(255,255,255,0.75)',
      letterSpacing: 1.5,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    bannerTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    bannerSubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
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
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: c.textPrimary,
      padding: 0,
    },
    filterRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.cardAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    filterChipActiveAll: {
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
      borderColor: c.primary,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
    },
    filterChipTextAll: {
      color: c.primary,
      fontWeight: '700',
    },
    wordCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: isDark ? '#000' : '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.25 : 0.05,
      shadowRadius: 8,
      elevation: 2,
      gap: 12,
    },
    wordIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    wordInfo: { flex: 1 },
    wordNameRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
      flexWrap: 'wrap',
    },
    articlePill: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    articlePillText: {
      fontSize: 11,
      fontWeight: '800',
    },
    wordText: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
    },
    translationText: {
      fontSize: 14,
      color: c.textSecondary,
      fontWeight: '400',
    },
    cardActions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
    },
    listenIconBtn: {
      padding: 8,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
    },
    iconBtn: {
      padding: 6,
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
      backgroundColor: c.cardAlt,
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '90%',
      maxWidth: 360,
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1.5,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 20,
    },
    modalIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalHeaderText: { flex: 1 },
    modalWordTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: c.textPrimary,
    },
    modalTranslation: {
      fontSize: 15,
      color: c.textSecondary,
      marginTop: 2,
    },
    modalMetaRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      backgroundColor: c.cardAlt,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalMetaItem: { flex: 1 },
    modalMetaLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    modalMetaValue: {
      fontSize: 14,
      fontWeight: '700',
    },
    modalExampleBox: {
      backgroundColor: c.cardAlt,
      borderRadius: 16,
      padding: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalExampleText: {
      fontSize: 14,
      color: c.textPrimary,
      fontStyle: 'italic',
      lineHeight: 20,
    },
    modalActions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 12,
      marginBottom: 16,
    },
    modalActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    modalActionBtnDelete: {
      borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    modalActionLabel: {
      fontSize: 14,
      fontWeight: '700',
    },
    modalCloseBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: c.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCloseBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textSecondary,
    },
    articlePillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    pluralTag: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    pluralTagText: {
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
  });
}