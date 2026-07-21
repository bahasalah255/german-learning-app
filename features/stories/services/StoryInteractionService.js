import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = 'stories.bookmarks';
const SAVED_WORDS_KEY = 'stories.savedWords';
const QUIZ_RESULTS_KEY = 'stories.quizResults';
const STORY_PROGRESS_KEY = 'stories.progress';
const LAST_STORY_KEY = 'stories.lastOpened';

function normalizeTerm(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.,/#!$%\^&\*;:{}=\-_`~()?¡¿"'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadBookmarks(storyId) {
  const all = await readJson(BOOKMARKS_KEY, []);
  return all.filter((item) => item.storyId === storyId);
}

export async function isParagraphBookmarked(storyId, paragraphId) {
  const bookmarks = await loadBookmarks(storyId);
  return bookmarks.some((item) => item.paragraphId === paragraphId);
}

export async function toggleBookmark({ storyId, paragraphId, paragraphOrder, excerpt }) {
  const all = await readJson(BOOKMARKS_KEY, []);
  const index = all.findIndex((item) => item.storyId === storyId && item.paragraphId === paragraphId);

  if (index >= 0) {
    all.splice(index, 1);
    await writeJson(BOOKMARKS_KEY, all);
    return { bookmarked: false, bookmarks: all.filter((item) => item.storyId === storyId) };
  }

  all.push({
    storyId,
    paragraphId,
    paragraphOrder,
    excerpt,
    createdAt: Date.now(),
  });

  await writeJson(BOOKMARKS_KEY, all);
  return { bookmarked: true, bookmarks: all.filter((item) => item.storyId === storyId) };
}

export async function loadSavedWords() {
  return readJson(SAVED_WORDS_KEY, []);
}

export async function isWordSaved(storyId, german) {
  const savedWords = await loadSavedWords();
  const key = `${storyId}:${normalizeTerm(german)}`;
  return savedWords.some((item) => item.wordKey === key);
}

export async function toggleSavedWord(word, storyId) {
  const savedWords = await loadSavedWords();
  const wordKey = `${storyId}:${normalizeTerm(word.german)}`;
  const index = savedWords.findIndex((item) => item.wordKey === wordKey);

  if (index >= 0) {
    savedWords.splice(index, 1);
    await writeJson(SAVED_WORDS_KEY, savedWords);
    return { saved: false, savedWords };
  }

  savedWords.push({
    wordKey,
    storyId,
    german: word.german,
    article: word.article ?? null,
    translation: word.translation ?? word.french ?? word.arabic ?? '',
    french: word.french ?? null,
    arabic: word.arabic ?? null,
    pronunciation: word.pronunciation ?? null,
    partOfSpeech: word.part_of_speech ?? word.partOfSpeech ?? null,
    exampleSentence: word.example_sentence ?? word.exampleSentence ?? null,
    difficulty: word.difficulty ?? null,
    createdAt: Date.now(),
  });

  await writeJson(SAVED_WORDS_KEY, savedWords);
  return { saved: true, savedWords };
}

export async function loadStoryProgress(storyId) {
  const all = await readJson(STORY_PROGRESS_KEY, []);
  return all.find((item) => item.storyId === storyId) || null;
}

export async function saveStoryProgress(storyId, patch) {
  const all = await readJson(STORY_PROGRESS_KEY, []);
  const index = all.findIndex((item) => item.storyId === storyId);
  const next = {
    storyId,
    updatedAt: Date.now(),
    ...((index >= 0 && all[index]) || {}),
    ...patch,
  };

  if (index >= 0) {
    all[index] = next;
  } else {
    all.unshift(next);
  }

  await writeJson(STORY_PROGRESS_KEY, all);
  return next;
}

export async function saveQuizResult(result) {
  const all = await readJson(QUIZ_RESULTS_KEY, []);
  all.unshift({
    ...result,
    createdAt: Date.now(),
  });
  await writeJson(QUIZ_RESULTS_KEY, all.slice(0, 100));
  return all[0];
}

export async function loadAllStoryProgress() {
  return readJson(STORY_PROGRESS_KEY, []);
}

export async function saveLastOpenedStory(storyId, storyTitle) {
  await writeJson(LAST_STORY_KEY, {
    storyId,
    storyTitle: storyTitle || '',
    openedAt: Date.now(),
  });
}

export async function loadLastOpenedStory() {
  return readJson(LAST_STORY_KEY, null);
}

export async function loadFavoriteWords() {
  return readJson('stories.favorites', []);
}

export async function isWordFavorited(storyId, german) {
  const favorites = await loadFavoriteWords();
  const key = `${storyId}:${normalizeTerm(german)}`;
  return favorites.some((item) => item.wordKey === key);
}

export async function toggleFavoriteWord(word, storyId) {
  const favorites = await loadFavoriteWords();
  const wordKey = `${storyId}:${normalizeTerm(word.german)}`;
  const index = favorites.findIndex((item) => item.wordKey === wordKey);

  if (index >= 0) {
    favorites.splice(index, 1);
    await writeJson('stories.favorites', favorites);
    return { favorited: false, favorites };
  }

  favorites.push({
    wordKey,
    storyId,
    german: word.german,
    article: word.article ?? null,
    translation: word.translation ?? word.french ?? word.arabic ?? '',
    french: word.french ?? null,
    arabic: word.arabic ?? null,
    pronunciation: word.pronunciation ?? null,
    partOfSpeech: word.part_of_speech ?? word.partOfSpeech ?? null,
    exampleSentence: word.example_sentence ?? word.exampleSentence ?? null,
    difficulty: word.difficulty ?? null,
    createdAt: Date.now(),
  });

  await writeJson('stories.favorites', favorites);
  return { favorited: true, favorites };
}

export { normalizeTerm };
