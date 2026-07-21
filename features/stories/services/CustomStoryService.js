/**
 * CustomStoryService.js
 *
 * Manages user-created stories stored offline in AsyncStorage.
 * Storage key: stories.custom
 * Does NOT touch StoryService or any official story data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOM_STORIES_KEY = 'stories.custom';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_STORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeAll(stories) {
  await AsyncStorage.setItem(CUSTOM_STORIES_KEY, JSON.stringify(stories));
}

function generateId() {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Split raw user text into paragraph objects compatible with StoryReaderScreen.
 *
 * Rules:
 *  - Blank lines  → paragraph boundary
 *  - Long runs (> WORDS_PER_PARA words with no blank line) → auto-split every WORDS_PER_PARA words
 *  - Each paragraph gets a stable paragraph_id, order, german_text
 *  - arabic_translation / french_translation are left empty (user can add via word popup)
 */
const WORDS_PER_PARA = 60;

export function contentToParagraphs(content) {
  const rawContent = String(content || '').trim();
  if (!rawContent) return [];

  // Split on blank lines first
  const blocks = rawContent
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const paragraphs = [];
  let order = 1;

  blocks.forEach((block) => {
    // Auto-split very long blocks
    const words = block.split(/\s+/);
    if (words.length <= WORDS_PER_PARA) {
      paragraphs.push(block);
    } else {
      for (let i = 0; i < words.length; i += WORDS_PER_PARA) {
        paragraphs.push(words.slice(i, i + WORDS_PER_PARA).join(' '));
      }
    }
  });

  return paragraphs.map((text, idx) => ({
    paragraph_id: `p_${idx + 1}`,
    order: order++,
    german_text: text,
    french_translation: '',
    arabic_translation: '',
  }));
}

/**
 * Build a full story object compatible with StoryReaderScreen from a custom story record.
 * Maps the stored { id, title, level, content, createdAt, updatedAt } shape to the
 * shape expected by StoryReaderScreen / StoryInteractionService.
 */
export function customStoryToReaderShape(customStory) {
  const paragraphs = contentToParagraphs(customStory.content);
  return {
    id: customStory.id,
    title: customStory.title,
    summary: '',
    category: 'My Stories',
    level: customStory.level || 'A1',
    difficulty: 'Custom',
    readingTime: Math.max(1, Math.round(paragraphs.length * 0.5)),
    wordCount: (customStory.content || '').split(/\s+/).filter(Boolean).length,
    xp: 0,
    paragraphs,
    vocabulary: [],
    quiz: [],
    coverImageSource: null,
    isCustom: true,
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/** Load all custom stories, newest first. */
export async function loadCustomStories() {
  const all = await readAll();
  return all.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
}

/** Get a single custom story by id, or null. */
export async function getCustomStoryById(id) {
  const all = await readAll();
  return all.find((s) => s.id === id) || null;
}

/**
 * Create a new custom story.
 * @param {{ title: string, level: string, content: string }} data
 */
export async function createCustomStory({ title, level, content }) {
  const all = await readAll();
  const now = Date.now();
  const story = {
    id: generateId(),
    title: (title || '').trim(),
    level: level || 'A1',
    content: (content || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  all.unshift(story);
  await writeAll(all);
  return story;
}

/**
 * Update an existing custom story.
 * Reading progress is preserved (lives in StoryInteractionService under the same id).
 * @param {string} id
 * @param {{ title?: string, level?: string, content?: string }} patch
 */
export async function updateCustomStory(id, patch) {
  const all = await readAll();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`Custom story "${id}" not found`);
  all[idx] = {
    ...all[idx],
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.level !== undefined ? { level: patch.level } : {}),
    ...(patch.content !== undefined ? { content: patch.content.trim() } : {}),
    updatedAt: Date.now(),
  };
  await writeAll(all);
  return all[idx];
}

/**
 * Delete a custom story by id.
 * Does NOT delete reading progress so the user's progress data stays consistent
 * (orphaned progress records are harmless).
 */
export async function deleteCustomStory(id) {
  const all = await readAll();
  const filtered = all.filter((s) => s.id !== id);
  await writeAll(filtered);
}
