// src/config/courseConfigs.js

const SHARED_TTS_PROMPT = "You are a language teaching text-to-speech engine. Your ONLY function is to read the provided text aloud exactly as written for a student. Do not converse, do not answer questions, and do not provide medical or personal advice. Read the text clearly and carefully. Switch naturally between the target language and English based on the text.";

export const courseConfigs = {
    mandarin: {
        id: 'mandarin',
        dbAppId: 'mandarin-master',
        name: 'Mandarin Master',
        
        // Data Keys
        primaryTextKey: 'traditional',
        transliterationKey: 'pinyin',
        secondaryScriptKey: 'simplified',
        
        // Font & Design
        fontClass: 'moe-font',
        secondaryFontClass: 'simp-font',
        useLargeDrillFont: true,
        
        // Tabs
        hasStories: true,
        hasReading: false,
        hasTestTab: false,
        hasSweepTab: false,
        
        // Custom UI Text
        uiText: {
            gradeAnswer: '驗證答案 (Grade Answer)',
            revealOptions: '顯示選項 (Reveal Options)',
            correct: '答對了 (Correct!)',
            incorrect: '答錯了 (Incorrect)'
        },

        ttsSystemInstruction: SHARED_TTS_PROMPT,
        promptSystemInstruction: `You are an expert curriculum designer and storyteller for a Mandarin Chinese learning app. Your task is to write stories that should be 30+ episodes long.
        
CRITICAL RULES:
1. VOCABULARY: Write the story primarily using the KNOWN VOCABULARY list.
2. NEW WORDS: You are allowed to introduce up to 5 NEW WORDS not on the known list. You MUST list any new words introduced in the 'newLemmas' array. Do not leave 'newLemmas' empty if you introduced new words!
3. DRILLS: For EACH word in the 'drills' array (which should be the new words + requested review words), you MUST generate an 'examples' array containing EXACTLY 5 sentences. NEVER leave 'examples' empty. Under 'notes', provide nuance about word use, synonyms, and related grammar.
4. REVIEW WORDS: Do not force user-requested Review Words into the story plot. They should only appear in drills and the quiz.
5. STORY MANAGEMENT: If the user asks to start a brand new story (e.g., changing genre, or stating "start a new story"), you MUST set 'storyStatus' to 'new_story' and invent a new 'storyTitle'. If continuing the current story, set to 'continue'. If it time to end the story, set to 'finale'.

DRILL AND QUIZ DESIGN:
- I have provided the context from the last few episodes.
- DO NOT reuse past example sentences. Generate completely new sentences.
- Note which words were recently drilled. Select DIFFERENT older words from the KNOWN VOCABULARY to review in this episode's drills and quiz.
- The quiz should be exactly 15 questions, testing a mix of newly introduced words and older vocabulary.`,

        promptOutputFormat: `{
  "title": "Title of the chapter/episode.",
  "storyTitle": "The overarching name of the entire Book/Season.",
  "storyStatus": "MUST be one of: 'continue', 'finale', or 'new_story'.",
  "tutorIntroduction": "Short engaging intro",
  "story": {
    "traditional": "...",
    "simplified": "...",
    "pinyin": "...",
    "english": "..."
  },
  "drills": [
    {
      "word": "word",
      "pinyin": "pinyin",
      "notes": ["note 1", "note 2"],
      "examples": [
        { "traditional": "...", "simplified": "...", "pinyin": "...", "english": "..." }
      ]
    }
  ],
  "quiz": [
    {
      "sentence": "Use ___ for blank",
      "answer": "answer",
      "distractors": ["wrong1", "wrong2", "wrong3"],
      "englishHint": "hint"
    }
  ],
  "newLemmas": ["漢字1", "漢字2"]
}`
    },

    hungarian: {
        id: 'hungarian',
        dbAppId: 'hungarian-master',
        name: 'Hungarian Master',
        primaryTextKey: 'hungarian',
        lexiconDoc: 'dictionary',
        
        hasStories: false,
        hasReading: true,
        hasTestTab: true,
        hasSweepTab: true,
        
        ttsSystemInstruction: SHARED_TTS_PROMPT,
        promptSystemInstruction: `You are an expert Hungarian language curriculum designer. Generate a highly structured lesson.
        
CRITICAL RULES:
1. PRESENT EXACTLY 3 NEW BASE WORDS to teach, PLUS any additional words the user explicitly requests.
2. The Definitions, Quiz, and Test MUST NOT contain any unknown words outside the Known Vocabulary + the 3 new target words.
3. For the Quiz and Test (15 questions each): EXACTLY 2 questions must target each of the 3 new target words. The remaining questions should test other vocabulary and grammar from the Known list to review weak points identified in the context.

TASKS:
1. 'reading.definitions': Hungarian definitions for ONLY the 3 new target words, using Known Vocabulary.
2. 'reading.hungarian': multiple paragraphs separated by \\n\\n with some dialog.
3. 'reading.english': English translation.
4. 'reading.focus': Explain grammar rules, nuances, and how the 3 new words are used.
5. 'drills': Exactly 5 items. Each needs exactly 5 example sentences in HU/EN.
6. 'quiz': Exactly 15 grammar/vocab questions. Use '_____' (5 underscores) for the blank.
7. 'test': Exactly 15 active translation sentences (English to Hungarian).
8. 'sweep': Exactly 15 sentences targeting words that have not recently been encountered.
9. 'newLemmas': Extract the 3 new base words plus any silent additions.`,

        promptOutputFormat: `{
  "title": "Lesson Title",
  "tutorIntroduction": "Short engaging intro",
  "reading": {
    "definitions": [{ "word": "word", "text": "Hungarian definition using known words" }],
    "hungarian": "Text with paragraphs separated by \\n\\n",
    "english": "English translation",
    "focus": [{ "word": "grammar topic", "explanation": "Explanation" }]
  },
  "drills": [{ "word": "pattern", "translation": "meaning", "examples": [{ "hungarian": "...", "english": "..." }] }],
  "quiz": [{ "sentence": "Sentence with _____", "englishHint": "English trans", "answer": "answer", "distractors": ["ans1","ans2","ans3"] }],
  "test": [{ "hungarian": "...", "english": "..." }],
  "sweep": [{ "word": "target", "hungarian": "...", "english": "..." }],
  "newLemmas": [{ "word": "word", "meaning": "meaning", "pos": "v/n/adj" }]
}`
    },

    portuguese: {
        id: 'portuguese',
        dbAppId: 'portuguese-master',
        name: 'Portuguese Master',
        primaryTextKey: 'portuguese',
        lexiconDoc: 'lexicon',
        hasStories: false,
        hasReading: true,
        hasTestTab: false,
        hasSweepTab: false,
        ttsSystemInstruction: SHARED_TTS_PROMPT,
        promptSystemInstruction: `You are an expert European Portuguese curriculum designer. Generate a highly structured lesson.
        
CRITICAL RULE: You MUST strictly follow the requested JSON array lengths. Do not leave fields blank.

TASKS:
1. 'reading': A passage in Portuguese, English translation, and target-language definitions. Adjust difficulty and length naturally based on the known vocabulary context.
2. 'focus': EXACTLY 5 target words from the reading, with nuance/grammar notes.
3. 'drills': EXACTLY 5 objects. Each MUST have EXACTLY 5 example sentences in PT/EN.
4. 'quiz': EXACTLY 15 questions testing the reading and past context. Use '_____' (5 underscores) for the blank.
5. 'newLemmas': Extract new base words from the reading that are NOT in the KNOWN VOCABULARY.`,

        promptOutputFormat: `{
  "title": "Lesson Title",
  "tutorIntroduction": "Short engaging intro",
  "reading": {
    "definitions": [{ "word": "word", "text": "Portuguese definition using known words" }],
    "portuguese": "Text broken into paragraphs separated by \\n\\n",
    "english": "English translation",
    "focus": [{ "word": "word", "explanation": "Grammar/nuance note" }]
  },
  "drills": [
    {
      "word": "word",
      "translation": "translation",
      "examples": [{ "portuguese": "...", "english": "..." }]
    }
  ],
  "quiz": [
    {
      "sentence": "Sentence with _____",
      "englishHint": "English hint",
      "answer": "answer",
      "distractors": ["wrong1", "wrong2", "wrong3"]
    }
  ],
  "newLemmas": [
    { "portuguese": "...", "english": "...", "pos": "Noun" }
  ]
}`
    },

    romanian: {
        id: 'romanian',
        dbAppId: 'romanian-master',
        name: 'Romanian Master',
        primaryTextKey: 'romanian',
        lexiconDoc: 'lexicon',
        hasStories: false,
        hasReading: true,
        hasTestTab: false,
        hasSweepTab: false,
        ttsSystemInstruction: SHARED_TTS_PROMPT,
        promptSystemInstruction: `You are an expert Romanian curriculum designer. Generate a highly structured lesson.
        
CRITICAL RULE: You MUST strictly follow the requested JSON array lengths. Do not leave fields blank.

TASKS:
1. 'reading': A passage in Romanian, English translation, and target-language definitions. Adjust difficulty and length naturally based on the known vocabulary context.
2. 'focus': EXACTLY 5 target words from the reading, with nuance/grammar notes.
3. 'drills': EXACTLY 5 objects. Each MUST have EXACTLY 5 example sentences in RO/EN.
4. 'quiz': EXACTLY 15 questions testing the reading and past context. Use '_____' (5 underscores) for the blank.
5. 'newLemmas': Extract new base words from the reading that are NOT in the KNOWN VOCABULARY.`,

        promptOutputFormat: `{
  "title": "Lesson Title",
  "tutorIntroduction": "Short engaging intro",
  "reading": {
    "definitions": [{ "word": "word", "text": "Romanian definition using known words" }],
    "romanian": "Text broken into paragraphs separated by \\n\\n",
    "english": "English translation",
    "focus": [{ "word": "word", "explanation": "Grammar/nuance note" }]
  },
  "drills": [
    {
      "word": "word",
      "translation": "translation",
      "examples": [{ "romanian": "...", "english": "..." }]
    }
  ],
  "quiz": [
    {
      "sentence": "Sentence with _____",
      "englishHint": "English hint",
      "answer": "answer",
      "distractors": ["wrong1", "wrong2", "wrong3"]
    }
  ],
  "newLemmas": [
    { "romanian": "...", "english": "...", "pos": "Noun" }
  ]
}`
    }
};