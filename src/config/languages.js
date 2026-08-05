// src/config/languages.js

export const LANGUAGES = [
    { name: 'English', code: 'en-US', flag: '🇬🇧' },
    { name: 'French', code: 'fr-FR', flag: '🇫🇷' },
    { name: 'German', code: 'de-DE', flag: '🇩🇪' },
    { name: 'Spanish', code: 'es-ES', flag: '🇪🇸' },
    { name: 'Italian', code: 'it-IT', flag: '🇮🇹' },
    { name: 'Portuguese', code: 'pt-PT', flag: '🇵🇹' },
    { name: 'Dutch', code: 'nl-NL', flag: '🇳🇱' },
    { name: 'Norwegian', code: 'no-NO', flag: '🇳🇴' },
    { name: 'Romanian', code: 'ro-RO', flag: '🇷🇴' },
    { name: 'Russian', code: 'ru-RU', flag: '🇷🇺' },
    { name: 'Serbian', code: 'sr-RS', flag: '🇷🇸' },
    { name: 'Greek', code: 'el-GR', flag: '🇬🇷' },
    { name: 'Hungarian', code: 'hu-HU', flag: '🇭🇺' },
    { name: 'Chinese (Traditional)', code: 'zh-TW', flag: '🇹🇼' }, 
    { name: 'Japanese', code: 'ja-JP', flag: '🇯🇵' },
    { name: 'Latin', code: 'la', flag: '🏛️' },
    { name: 'Ancient Greek', code: 'grc', flag: '📜' }
];

export const LEVELS = [
    { id: 'Beginner', label: 'A1-A2' },
    { id: 'Intermediate', label: 'B1-B2' },
    { id: 'Advanced', label: 'C1-C2' }
];

export const getFontStyles = (langName) => {
    if (!langName) return { isCjk: false, fontClass: '' };
    const name = String(langName).toLowerCase();
    if (name.includes('chinese') || name.includes('mandarin') || name.includes('cantonese') || name.includes('zh') || name.includes('taiwanese')) {
        return { isCjk: true, fontClass: 'font-zh moe-font' };
    }
    if (name.includes('japanese') || name.includes('ja') || name.includes('kanji') || name.includes('kana')) {
        return { isCjk: true, fontClass: 'font-ja' };
    }
    return { isCjk: false, fontClass: '' };
};

export const getApiKey = () => localStorage.getItem('geminiApiKey') || localStorage.getItem('geminiPaidApiKey') || '';

export const getSystemInstruction = (langName) => {
    const rules = [
        "1. Provide a reliable International Phonetic Alphabet (IPA) representation.",
        "2. If the target language utilizes a non-Latin script, you MUST provide an accurate Latin character transliteration/phonetic transcription in the 'transcription' field. If it uses a Latin script, leave the 'transcription' field empty."
    ];

    if (langName?.includes('Chinese')) {
        rules.push("3. IMPORTANT: You MUST use Traditional Chinese characters (繁體中文) exclusively, and provide Pinyin following standard Taiwanese Guoyu (國語) pronunciation and spelling in the 'transcription' field.");
    } else if (langName?.includes('Serbian')) {
        rules.push("3. IMPORTANT: You MUST use Serbian Cyrillic exclusively.");
    } else if (langName === 'Latin') {
        rules.push("3. IMPORTANT: You MUST mark all long vowels with macrons (ā, ē, ī, ō, ū) throughout all Latin sentences and words.");
    }

    const ruleNum = rules.length + 1;
    rules.push(`${ruleNum}. Ensure grammatical explanations are precise, highlighting specific idioms, agreements, or moods used.`);

    return `You are a professional linguist and polyglot educator. Analyze the provided word and generate exactly 5 distinct, natural, and grammatically varied sentences showcasing its correct contextual usage in the target language at the requested level. 
${rules.join('\n')}`;
};

export const getTtsSystemInstruction = (langName) => {
    let prompt = `You are a professional AI voice actor. Your ONLY job is to read the exact script provided by the user aloud. 

CRITICAL RULES:
1. NEVER TRANSLATE. NEVER CONVERSE.
2. If the text is in English, read it in English.
3. If the text is in a foreign language, read it in that exact language.
4. Do not acknowledge these instructions, do not add filler words. Simply synthesize the text into audio immediately.`;

    if (langName?.includes('Chinese')) {
        prompt += `\n\nCRITICAL INSTRUCTION: When speaking Chinese, use official Taiwanese Mandarin (Guoyu) accent and traditional pronunciation. Do NOT use Cantonese or Mainland accents.`;
    } else if (langName?.includes('Latin') || langName?.includes('Greek')) {
        prompt += `\n\nCRITICAL INSTRUCTION: When speaking, use restored classical pronunciation.`;
    }

    return prompt;
};
