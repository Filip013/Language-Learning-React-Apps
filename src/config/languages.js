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

export async function fetchGeminiContent({ model = 'gemini-4-hydrogen', payload, keyPreference = 'free' }) {
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

export function parsePartialJson(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    try {
        return JSON.parse(trimmed);
    } catch {
        // Continue to partial JSON repair
    }

    let inString = false;
    let escaped = false;
    const stack = [];

    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
        } else {
            if (ch === '"') {
                inString = true;
            } else if (ch === '{' || ch === '[') {
                stack.push(ch);
            } else if (ch === '}' || ch === ']') {
                stack.pop();
            }
        }
    }

    let repaired = trimmed;
    if (inString) {
        if (escaped) {
            repaired = repaired.slice(0, -1);
        }
        repaired += '"';
    }

    // Remove trailing incomplete key/colon/comma before closing open containers
    repaired = repaired.trimEnd();
    if (repaired.endsWith(':')) {
        repaired = repaired.slice(0, -1).trimEnd();
        // Strip the dangling key string before the colon
        if (repaired.endsWith('"')) {
            repaired = repaired.replace(/"(?:\\.|[^"\\])*"\s*$/, '').trimEnd();
        }
    } else if (stack.length > 0 && stack[stack.length - 1] === '{' && /[{,]\s*"(?:\\.|[^"\\])*"\s*$/.test(repaired)) {
        // Dangling object key with no colon yet
        repaired = repaired.replace(/"(?:\\.|[^"\\])*"\s*$/, '').trimEnd();
    }

    if (repaired.endsWith(',')) {
        repaired = repaired.slice(0, -1).trimEnd();
    }

    for (let i = stack.length - 1; i >= 0; i--) {
        repaired += stack[i] === '{' ? '}' : ']';
    }

    try {
        return JSON.parse(repaired);
    } catch {
        return null;
    }
}

export async function fetchGeminiContentStream({ model = 'gemini-4-hydrogen', payload, keyPreference = 'free', onChunk }) {
    const freeKey = (localStorage.getItem('geminiApiKey') || '').trim();
    const paidKey = (localStorage.getItem('geminiPaidApiKey') || '').trim();

    const primaryKey = keyPreference === 'paid' ? (paidKey || freeKey) : (freeKey || paidKey);
    const fallbackKey = keyPreference === 'paid'
        ? (primaryKey === paidKey && freeKey ? freeKey : '')
        : (primaryKey === freeKey && paidKey ? paidKey : '');

    if (!primaryKey) {
        throw new Error("No Gemini API Key found in settings. Please add your key in the Hub settings.");
    }

    const makeStreamRequest = async (key) => {
        return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    };

    let res = await makeStreamRequest(primaryKey);

    if ((res.status === 429 || res.status === 503) && fallbackKey && fallbackKey !== primaryKey) {
        console.warn(`[Gemini API Stream] Primary (${keyPreference}) key returned ${res.status}. Automatically retrying with fallback key...`);
        res = await makeStreamRequest(fallbackKey);
    }

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || "API Connection Failed");
    }

    if (!res.body) {
        throw new Error("Streaming not supported by response.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    let accumulatedText = '';

    const processLines = (lines) => {
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
                const parsedChunk = JSON.parse(jsonStr);
                const parts = parsedChunk.candidates?.[0]?.content?.parts || [];
                let sawNewText = false;
                let isThinking = false;

                for (const part of parts) {
                    if (part.thought) {
                        isThinking = true;
                    } else if (typeof part.text === 'string' && part.text.length > 0) {
                        accumulatedText += part.text;
                        sawNewText = true;
                    }
                }

                if ((sawNewText || isThinking) && onChunk) {
                    onChunk(accumulatedText, { isThinking });
                }
            } catch {
                // Ignore malformed partial SSE line
            }
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split(/\r?\n/);
        sseBuffer = lines.pop() || '';
        processLines(lines);
    }

    if (sseBuffer.trim()) {
        processLines([sseBuffer]);
    }

    return accumulatedText;
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
