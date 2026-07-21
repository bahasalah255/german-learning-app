import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useLanguage } from '../../../utils/LanguageContext';
import { getSavedLevel } from '../services/PlacementService';
import {
  loadStories,
  getStoryCategories,
  getStoryLevels,
} from '../services/StoryService';
import { loadAllStoryProgress } from '../services/StoryInteractionService';
import {
  loadCustomStories,
  createCustomStory,
  updateCustomStory,
  deleteCustomStory,
} from '../services/CustomStoryService';
import StoryCard from '../components/StoryCard';

export default function StoryLibraryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t, isRTL } = useLanguage();

  const [stories, setStories] = useState([]);
  const [customStories, setCustomStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState(route.params?.level || 'A1');
  const [savedLevel, setSavedLevel] = useState(route.params?.level || null);
  const [progressMap, setProgressMap] = useState({});

  // Form modal states
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingStory, setEditingStory] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formLevel, setFormLevel] = useState('A1');
  const [formContent, setFormContent] = useState('');
  const [levelDropdownOpen, setLevelDropdownOpen] = useState(false);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    const [loadedStories, loadedCustom, storedLevel, allProgress] = await Promise.all([
      loadStories(),
      loadCustomStories(),
      getSavedLevel(),
      loadAllStoryProgress(),
    ]);
    const routeLevel = route.params?.level || null;
    const nextLevel = routeLevel || storedLevel || 'A1';

    setStories(loadedStories);
    setCustomStories(loadedCustom);
    setSavedLevel(storedLevel || routeLevel || null);
    setLevelFilter(nextLevel);

    // Build a quick lookup: storyId → percentage
    const map = {};
    allProgress.forEach((item) => {
      if (item.storyId) map[item.storyId] = item.percentage ?? 0;
    });
    setProgressMap(map);

    setLoading(false);
  }, [route.params?.level]);

  useFocusEffect(
    useCallback(() => {
      loadLibrary();
    }, [loadLibrary])
  );

  const categories = useMemo(() => {
    const list = ['All', ...getStoryCategories(stories)];
    if (!list.includes('My Stories')) {
      list.push('My Stories');
    }
    return list;
  }, [stories]);

  const levelOptions = useMemo(() => {
    return ['All', ...getStoryLevels(stories)];
  }, [stories]);

  const visibleOfficialStories = useMemo(() => {
    if (categoryFilter === 'My Stories') return [];

    const baseStories = levelFilter === 'All'
      ? stories
      : stories.filter((story) => story.level === levelFilter);

    const categoryFiltered = categoryFilter === 'All'
      ? baseStories
      : baseStories.filter((story) => story.category === categoryFilter);

    const searchFiltered = search.trim()
      ? categoryFiltered.filter((story) => {
          const term = search.trim().toLowerCase();
          return [story.title, story.subtitle, story.summary, story.category]
            .some((value) => String(value || '').toLowerCase().includes(term));
        })
      : categoryFiltered;

    return searchFiltered;
  }, [stories, levelFilter, categoryFilter, search]);

  const visibleCustomStories = useMemo(() => {
    if (categoryFilter !== 'All' && categoryFilter !== 'My Stories') return [];

    const baseStories = levelFilter === 'All'
      ? customStories
      : customStories.filter((story) => story.level === levelFilter);

    const searchFiltered = search.trim()
      ? baseStories.filter((story) => {
          const term = search.trim().toLowerCase();
          return [story.title, story.content]
            .some((value) => String(value || '').toLowerCase().includes(term));
        })
      : baseStories;

    return searchFiltered;
  }, [customStories, levelFilter, categoryFilter, search]);

  const openAddModal = () => {
    setEditingStory(null);
    setFormTitle('');
    setFormLevel('A1');
    setFormContent('');
    setLevelDropdownOpen(false);
    setFormModalVisible(true);
  };

  const openEditModal = (story) => {
    setEditingStory(story);
    setFormTitle(story.title);
    setFormLevel(story.level || 'A1');
    setFormContent(story.content || '');
    setLevelDropdownOpen(false);
    setFormModalVisible(true);
  };

  const handleSaveStory = async () => {
    if (!formTitle.trim()) {
      Alert.alert(t('common.error') || 'Error', t('stories.titleRequired'));
      return;
    }
    if (!formContent.trim()) {
      Alert.alert(t('common.error') || 'Error', t('stories.contentRequired'));
      return;
    }

    try {
      if (editingStory) {
        await updateCustomStory(editingStory.id, {
          title: formTitle,
          level: formLevel,
          content: formContent,
        });
      } else {
        await createCustomStory({
          title: formTitle,
          level: formLevel,
          content: formContent,
        });
      }
      setFormModalVisible(false);
      await loadLibrary();
    } catch (err) {
      Alert.alert(t('common.error') || 'Error', String(err.message || err));
    }
  };

  const confirmDelete = (story) => {
    Alert.alert(
      t('stories.deleteStory') || 'Delete Story',
      t('stories.deleteConfirm') || 'Are you sure you want to delete this story?',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.delete') || 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteStory(story.id),
        },
      ]
    );
  };

  const handleDeleteStory = async (id) => {
    try {
      await deleteCustomStory(id);
      await loadLibrary();
    } catch (err) {
      Alert.alert(t('common.error') || 'Error', String(err.message || err));
    }
  };

  const headerLevel = savedLevel || levelFilter;

  const renderHeader = () => (
    <View>
      <LinearGradient
        colors={['#6366F1', '#8B5CF6', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.heroRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <View style={styles.heroTextWrap}>
            <Text style={[styles.heroEyebrow, isRTL && { textAlign: 'right' }]}>{t('stories.libraryEyebrow')}</Text>
            <Text style={[styles.heroTitle, isRTL && { textAlign: 'right' }]}>{t('stories.libraryTitle')}</Text>
            <Text style={[styles.heroSubtitle, isRTL && { textAlign: 'right' }]}>
              {t('stories.librarySubtitle')}
            </Text>
          </View>
          <Ionicons name="library-outline" size={38} color="rgba(255,255,255,0.92)" />
        </View>
      </LinearGradient>

      <View style={styles.levelSummaryCard}>
        <View>
          <Text style={styles.levelSummaryLabel}>{t('stories.currentLevel')}</Text>
          <Text style={styles.levelSummaryValue}>{headerLevel}</Text>
        </View>
        <View style={styles.levelSummaryBadge}>
          <Text style={styles.levelSummaryBadgeText}>
            {(visibleOfficialStories.length + visibleCustomStories.length)} {t('stories.stories')}
          </Text>
        </View>
      </View>

      <View style={[styles.searchWrap, isRTL && { flexDirection: 'row-reverse' }]}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
          value={search}
          onChangeText={setSearch}
          placeholder={t('stories.searchHint')}
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={[styles.filterLabel, isRTL && { textAlign: 'right' }]}>{t('stories.categoryFilter')}</Text>
      <FlatList
        data={categories}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => {
          const active = item === categoryFilter;
          const isAll = item === 'All';
          return (
            <TouchableOpacity
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCategoryFilter(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {isAll ? t('stories.allCategories') : item}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <Text style={[styles.filterLabel, isRTL && { textAlign: 'right' }]}>{t('stories.levelFilter')}</Text>
      <FlatList
        data={levelOptions}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => {
          const active = item === levelFilter;
          const isAll = item === 'All';
          return (
            <TouchableOpacity
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setLevelFilter(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {isAll ? t('stories.allLevels') : item}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  const renderFormModal = () => {
    return (
      <Modal
        visible={formModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFormModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.formModalCard}>
            <View style={[styles.formModalHeader, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={styles.formModalTitle}>
                {editingStory ? t('stories.editStory') : t('stories.addStory')}
              </Text>
              <TouchableOpacity onPress={() => setFormModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formModalContent} showsVerticalScrollIndicator={false}>
              {/* Title input */}
              <Text style={[styles.fieldLabel, isRTL && { textAlign: 'right' }]}>
                {t('stories.storyTitle')}
              </Text>
              <TextInput
                style={[styles.input, isRTL && { textAlign: 'right' }]}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder={t('stories.storyTitle')}
                placeholderTextColor="#9CA3AF"
              />

              {/* Level dropdown */}
              <Text style={[styles.fieldLabel, isRTL && { textAlign: 'right' }]}>
                {t('stories.levelFilter')}
              </Text>
              <View style={{ zIndex: 1000, position: 'relative' }}>
                <TouchableOpacity
                  style={[styles.dropdownTrigger, isRTL && { flexDirection: 'row-reverse' }]}
                  onPress={() => setLevelDropdownOpen(!levelDropdownOpen)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownTriggerText}>{formLevel}</Text>
                  <Ionicons name={levelDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#6B7280" />
                </TouchableOpacity>

                {levelDropdownOpen && (
                  <View style={styles.dropdownMenu}>
                    {['A1', 'A2', 'B1', 'B2', 'C1'].map((lvl) => (
                      <TouchableOpacity
                        key={lvl}
                        style={[styles.dropdownItem, formLevel === lvl && styles.dropdownItemActive]}
                        onPress={() => {
                          setFormLevel(lvl);
                          setLevelDropdownOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dropdownItemText, formLevel === lvl && styles.dropdownItemTextActive]}>
                          {lvl}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Content input */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }, isRTL && { textAlign: 'right' }]}>
                {t('stories.storyContent')}
              </Text>
              <TextInput
                style={[styles.contentInput, isRTL && { textAlign: 'right' }]}
                value={formContent}
                onChangeText={setFormContent}
                placeholder={t('stories.storyContent')}
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              {/* Actions row */}
              <View style={[styles.formActionsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity
                  style={[styles.formBtn, styles.btnCancel]}
                  onPress={() => setFormModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnCancelText}>{t('common.cancel') || 'Cancel'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formBtn, styles.btnSave]}
                  onPress={handleSaveStory}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSaveText}>{t('stories.saveStory')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderCustomStoryCard = (story) => {
    const progress = progressMap[story.id] ?? 0;
    return (
      <View key={story.id} style={styles.customCard}>
        <View style={styles.customCardHeader}>
          <View style={[styles.customCardRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={styles.categoryPillCustom}>
              <Ionicons name="book-outline" size={12} color="#10B981" />
              <Text style={styles.categoryTextCustom}>My Stories</Text>
            </View>
            <View style={styles.levelPillCustom}>
              <Text style={styles.levelTextCustom}>{story.level}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.customCardTitle, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
          {story.title}
        </Text>
        <Text style={[styles.customCardSubtitle, isRTL && { textAlign: 'right' }]} numberOfLines={3}>
          {story.content}
        </Text>

        <View style={styles.progressWrapCustom}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { backgroundColor: '#10B981', width: `${Math.min(progress, 100)}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: '#10B981' }]}>{Math.round(progress)}%</Text>
        </View>

        <View style={[styles.customCardActions, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity
            style={[styles.customActionBtn, styles.btnRead]}
            onPress={() => navigation.navigate('StoryReader', { storyId: story.id })}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-outline" size={14} color="#FFFFFF" />
            <Text style={styles.btnReadText}>{t('stories.startReading')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.customActionBtn, styles.btnEdit]}
            onPress={() => openEditModal(story)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={14} color="#4F46E5" />
            <Text style={styles.btnEditText}>{t('common.edit') || 'Edit'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.customActionBtn, styles.btnDelete]}
            onPress={() => confirmDelete(story)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
            <Text style={styles.btnDeleteText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {renderHeader()}

        {/* Section: Official Stories */}
        {visibleOfficialStories.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={[styles.sectionHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
                {t('stories.officialStories')}
              </Text>
            </View>
            {visibleOfficialStories.map((item) => (
              <StoryCard
                key={item.id}
                story={item}
                progress={progressMap[item.id] ?? 0}
                onPress={() => navigation.navigate('StoryDetail', { storyId: item.id })}
              />
            ))}
          </View>
        )}

        {/* Divider */}
        {visibleOfficialStories.length > 0 && visibleCustomStories.length > 0 && (
          <View style={styles.dividerLine} />
        )}

        {/* Section: My Stories */}
        <View style={{ marginBottom: 24 }}>
          <View style={[styles.sectionHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
              {t('stories.myStories')}
            </Text>
            <TouchableOpacity style={styles.createStoryBtn} onPress={openAddModal} activeOpacity={0.85}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.createStoryBtnText}>{t('stories.addStory')}</Text>
            </TouchableOpacity>
          </View>

          {visibleCustomStories.length > 0 ? (
            visibleCustomStories.map(renderCustomStoryCard)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="create-outline" size={34} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>{t('stories.noStoriesTitle')}</Text>
              <Text style={styles.emptySubtitle}>{t('stories.noStoriesBody')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {renderFormModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
  },
  levelSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  levelSummaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  levelSummaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  levelSummaryBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  levelSummaryBadgeText: {
    color: '#4F46E5',
    fontWeight: '800',
    fontSize: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A2E',
    padding: 0,
  },
  filterLabel: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  chipRow: {
    gap: 8,
    paddingBottom: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  chipActive: {
    backgroundColor: '#EEF2FF',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  chipTextActive: {
    color: '#4F46E5',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 28,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  dividerLine: {
    height: 1.5,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
    borderRadius: 999,
  },
  createStoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 4,
  },
  createStoryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  customCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  customCardHeader: {
    marginBottom: 8,
  },
  customCardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryPillCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
  },
  categoryTextCustom: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  levelPillCustom: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F5F3FF',
  },
  levelTextCustom: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '800',
  },
  customCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  customCardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
    marginBottom: 12,
  },
  progressWrapCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  customCardActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  customActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    minWidth: 70,
  },
  btnRead: {
    backgroundColor: '#10B981',
    flex: 1,
  },
  btnReadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnEdit: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  btnEditText: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '700',
  },
  btnDelete: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  btnDeleteText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  formModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  formModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  formModalContent: {
    padding: 24,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 16,
  },
  contentInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 120,
    marginBottom: 20,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
  },
  dropdownTriggerText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '700',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1001,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemActive: {
    backgroundColor: '#F5F3FF',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  formBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: '#F3F4F6',
  },
  btnCancelText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '700',
  },
  btnSave: {
    backgroundColor: '#10B981',
  },
  btnSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
