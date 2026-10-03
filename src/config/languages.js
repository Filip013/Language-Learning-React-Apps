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

export const getFontStyles = (langName, textContent = '') => {
    const name = String(langName || '').toLowerCase();
    const str = String(textContent || '');
    const hasKana = /[\u3040-\u30ff]/.test(str);
    const hasHan = /[\u4e00-\u9fff]/.test(str);

    if (name.includes('japanese') || name.includes('ja') || name.includes('kanji') || name.includes('kana') || hasKana) {
        return { isCjk: true, fontClass: 'font-ja' };
    }
    if (name.includes('chinese') || name.includes('mandarin') || name.includes('cantonese') || name.includes('zh') || name.includes('taiwanese') || name.includes('cjk') || hasHan) {
        return { isCjk: true, fontClass: 'font-zh moe-font' };
    }
    return { isCjk: false, fontClass: '' };
};

export const getFreeApiKey = () => localStorage.getItem('geminiApiKey') || localStorage.getItem('geminiPaidApiKey') || '';
export const getPaidApiKey = () => localStorage.getItem('geminiPaidApiKey') || localStorage.getItem('geminiApiKey') || '';
export const getApiKey = getFreeApiKey;

export async function fetchGeminiContent({ model = 'gemini-3.5-flash-lite', payload, keyPreference = 'free' }) {
    const freeKey = (localStorage.getItem('geminiApiKey') || '').trim();
    const paidKey = (localStorage.getItem('geminiPaidApiKey') || '').trim();

    const primaryKey = keyPreference === 'paid' ? (paidKey || freeKey) : (freeKey || paidKey);
    const fallbackKey = keyPreference === 'paid' 
        ? (primaryKey === paidKey && freeKey ? freeKey : '') 
        : (primaryKey === freeKey && paidKey ? paidKey : '');

    if (!primaryKey) {
        throw new Error("No Gemini API Key found in settings. Please add your key in the Hub settings.");
    }

    const makeRequest = async (key) => {
        return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    };

    let res = await makeRequest(primaryKey);

    // If rate-limited (429) or temporary server overload (503), and a separate fallback key is present, retry with fallback
    if ((res.status === 429 || res.status === 503) && fallbackKey && fallbackKey !== primaryKey) {
        console.warn(`[Gemini API] Primary (${keyPreference}) key returned ${res.status}. Automatically retrying with fallback key...`);
        res = await makeRequest(fallbackKey);
    }

    return res;
}

export const getSystemInstruction = (langName) => {
    const rules = [
        "1. Provide a reliable International Phonetic Alphabet (IPA) representation.",
        "2. If the target language utilizes a non-Latin script, you MUST provide an accurate Latin character transliteration/phonetic transcription in the 'transcription' field. If it uses a Latin script, leave the 'transcription' field empty."
    ];

    if (langName?.includes('Chinese')) {
        rules.push("3. IMPORTANT: You MUST use Traditional Chinese characters (繁體中文) exclusively, and provide Pinyin following standard Taiwanese Guoyu (國語) pronunciation and spelling in the 'transcription' field.");
    } else if (langName === 'Portuguese') {
        rules.push("3. IMPORTANT: You MUST use standard European Portuguese (pt-PT) vocabulary, spelling, grammar, and idioms (not Brazilian Portuguese).");
    } else if (langName === 'Spanish') {
        rules.push("3. IMPORTANT: You MUST use standard European Spanish (Castilian) vocabulary, grammar, and idioms.");
    } else if (langName?.includes('Serbian')) {
        rules.push("3. IMPORTANT: You MUST use Serbian Cyrillic exclusively.");
    } else if (langName === 'Latin') {
        rules.push("3. IMPORTANT: You MUST mark all long vowels with macrons (ā, ē, ī, ō, ū) throughout all Latin sentences and words.");
    } else if (langName === 'Ancient Greek') {
        rules.push("3. IMPORTANT: Mark long vowels with macrons (ā, ē, ī, ō, ȳ) in the Latinized transliteration/transcription field.");
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

    const name = String(langName || '').trim();

    if (name.includes('Chinese') || name.includes('Mandarin')) {
        prompt += `\n\nCRITICAL INSTRUCTION: When speaking Mandarin Chinese, use a strict Taiwanese Mandarin (Guoyu) accent and traditional pronunciation. Do NOT use Cantonese or Mainland accents.`;
    } else if (name === 'Portuguese') {
        prompt += `\n\nCRITICAL INSTRUCTION: When speaking Portuguese, use a strict European Portuguese (pt-PT) accent and phonology.`;
    } else if (name === 'Spanish') {
        prompt += `\n\nCRITICAL INSTRUCTION: When speaking Spanish, use standard European Spanish (Castilian) pronunciation.`;
    } else if (name === 'French') {
        prompt += `\n\nCRITICAL INSTRUCTION: When speaking French, use standard metropolitan French pronunciation.`;
    } else if (name === 'German') {
        prompt += `\n\nCRITICAL INSTRUCTION: When speaking German, use standard Hochdeutsch pronunciation.`;
    } else if (name === 'Italian') {
        prompt += `\n\nCRITICAL INSTRUCTION: When speaking Italian, use standard Italian pronunciation.`;
    } else if (name === 'Japanese') {
        prompt += `\n\nCRITICAL INSTRUCTION: When speaking Japanese, use standard Japanese (Hyōjungo) pronunciation.`;
    } else if (name === 'Latin') {
        prompt += `\n\nCRITICAL INSTRUCTION: When speaking Latin, use Classical Latin pronunciation.`;
    } else if (name === 'Ancient Greek') {
        prompt += `\n\nCRITICAL INSTRUCTION: When the text is Ancient Greek (including its Latinized transliteration), read it using restored Classical pronunciation, maintaining proper vowel lengths, diphthongs, and pitch accents. When the text is English, read it in English.`;
    } else if (name === 'Hungarian') {
        prompt += `\n\nCRITICAL INSTRUCTION: Evaluate the primary language of the sentence before speaking. If the sentence is in English but starts with or contains a Hungarian name (e.g., 'Tamás', 'János'), you MUST read the entire sentence with a natural, native English accent. Do not switch to a Hungarian accent for the English words.`;
    }

    return prompt;
};
