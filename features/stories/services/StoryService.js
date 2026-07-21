const a1Pack = require('../data/stories/A1/a1_pack_01.json');
const a2Pack = require('../data/stories/A2/a2_pack_01.json');
const b1Pack = require('../data/stories/B1/b1_pack_01.json');
const b2Pack = require('../data/stories/B2/b2_pack_01.json');

const COVER_MAP = {
  'cover-1': require('../../../assets/alamd.png'),
  'cover-2': require('../../../assets/alamd_story.jpeg'),
  'cover-3': require('../../../assets/tab.png'),
  'cover-4': require('../../../assets/alamd.png'),
  'cover-5': require('../../../assets/alamd_story.jpeg'),
};

function normalizeStory(story, fallbackIndex = 0) {
  const coverKey = story.coverImage || `cover-${(fallbackIndex % 5) + 1}`;
  const readingTime = story.readingTime ?? story.estimated_reading_time ?? 3;
  const wordCount = story.wordCount ?? story.word_count ?? 0;
  const xp = story.xp ?? story.xp_reward ?? 0;
  const difficulty = story.difficulty ?? 'Easy';
  const paragraphs = Array.isArray(story.paragraphs) ? story.paragraphs : [];
  const vocabulary = Array.isArray(story.vocabulary) ? story.vocabulary : [];
  const quiz = Array.isArray(story.quiz) ? story.quiz : [];

  return {
    ...story,
    subtitle: story.subtitle || story.summary || '',
    readingTime,
    wordCount,
    xp,
    difficulty,
    paragraphs,
    vocabulary,
    quiz,
    coverImageSource: COVER_MAP[coverKey] || COVER_MAP['cover-1'],
  };
}

const SOURCE_PACKS = [a1Pack, a2Pack, b1Pack, b2Pack].filter((pack) => Array.isArray(pack?.stories));

const ALL_STORIES = SOURCE_PACKS.flatMap((pack) => (pack.stories || []).map((story, index) => normalizeStory(story, index)));

export async function loadStories() {
  return [...ALL_STORIES];
}

export async function getStoriesByLevel(level) {
  if (!level) return loadStories();
  return ALL_STORIES.filter((story) => story.level === level);
}

export async function searchStories(query, stories = ALL_STORIES) {
  const term = (query || '').trim().toLowerCase();
  if (!term) return [...stories];

  return stories.filter((story) => {
    return [story.title, story.subtitle, story.summary, story.category, story.level]
      .some((value) => String(value || '').toLowerCase().includes(term));
  });
}

export async function filterByCategory(category, stories = ALL_STORIES) {
  if (!category || category === 'All') return [...stories];
  return stories.filter((story) => story.category === category);
}

export async function getStoryById(id) {
  return ALL_STORIES.find((story) => story.id === id) || null;
}

export function getStoryCategories(stories = ALL_STORIES) {
  return Array.from(new Set(stories.map((story) => story.category))).sort();
}

export function getStoryLevels(stories = ALL_STORIES) {
  return Array.from(new Set(stories.map((story) => story.level))).sort();
}
