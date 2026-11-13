// scripts/list_models.js
import fs from 'fs';
import path from 'path';

function getKey() {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
    if (process.env.GEMINI_PAID_API_KEY) return process.env.GEMINI_PAID_API_KEY.trim();

    for (const file of ['.env.local', '.env']) {
        const fullPath = path.resolve(file);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            for (const line of content.split(/\r?\n/)) {
                const match = line.match(/^\s*(?:GEMINI_API_KEY|GEMINI_PAID_API_KEY|VITE_GEMINI_API_KEY)\s*=\s*(.+?)\s*$/);
                if (match) {
                    return match[1].replace(/^["']|["']$/g, '').trim();
                }
            }
        }
    }
    return null;
}

async function main() {
    const key = getKey();
    if (!key) {
        console.error("❌ No GEMINI_API_KEY found in .env or .env.local.");
        console.error("Please add your key to .env.local (e.g. GEMINI_API_KEY=AIzaSy...) and run again.");
        process.exit(1);
    }

    console.log("🔍 Querying https://generativelanguage.googleapis.com/v1beta/models ...");
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=100`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error(`❌ HTTP Error ${res.status}:`, err.error?.message || res.statusText);
            process.exit(1);
        }

        const data = await res.json();
        const models = data.models || [];

        if (models.length === 0) {
            console.log("No models returned.");
            return;
        }

        console.log(`\n✅ Retrieved ${models.length} models from v1beta/models:\n`);

        const formatted = models.map(m => {
            const id = m.name.replace('models/', '');
            const methods = (m.supportedGenerationMethods || []).join(', ');
            return {
                id,
                displayName: m.displayName || '',
                inputLimit: m.inputTokenLimit ? `${(m.inputTokenLimit / 1000).toFixed(0)}k` : 'N/A',
                outputLimit: m.outputTokenLimit ? `${(m.outputTokenLimit / 1000).toFixed(0)}k` : 'N/A',
                methods
            };
        });

        // Filter / Highlight noteworthy models
        const interesting = formatted.filter(m => 
            /carbon|hydrogen|helix|flash|pro|live/i.test(m.id) || /carbon|hydrogen|helix/i.test(m.displayName)
        );

        console.log("=== Highlighted Models (Carbon, Hydrogen, Helix, Flash, Pro, Live) ===");
        console.table(interesting);

        console.log("\n=== Full Model ID List ===");
        console.log(formatted.map(m => `• ${m.id} (${m.displayName})`).join('\n'));

    } catch (e) {
        console.error("❌ Network or Execution Error:", e);
    }
}

main();
