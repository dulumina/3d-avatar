import { GEMINI_KEY, GEMINI_MODELS } from './constants.js'
import { cleanWord } from './utils.js'

const GESTURE_CACHE = new Map()

const KEYWORD_MAP = [
    { words: ['halo', 'hai', 'hi', 'hey', 'selamat', 'assalamualaikum', 'selamatpagi', 'selamatsiang', 'selamatmalam', 'selamatdatang'], g: 'handup' },
    { words: ['salam', 'hormat'], g: 'namaste' },
    { words: ['marilah', 'ayok', 'ayo', 'mari', 'ayolah', 'majulah'], g: 'handup' },
    { words: ['saya', 'aku', 'kami', 'kitah', 'gue', 'gw', 'akuh'], g: 'index' },
    { words: ['kamu', 'anda', 'kau', 'dikau', 'lu', 'elo', 'saudara', 'hadirin'], g: 'side' },
    { words: ['mereka', 'semua', 'publik', 'warga', 'masyarakat', 'rakyat', 'hadirin', 'audiens', 'tamu', 'khalayak'], g: 'side' },
    { words: ['tidak', 'bukan', 'jangan', 'nggak', 'ga', 'gak', 'tak', 'tiada', 'tanpa'], g: 'shrug' },
    { words: ['mungkin', 'kurangtahu', 'bingung', 'entah', 'terserah', 'entahlah', 'kurangpaham'], g: 'shrug' },
    { words: ['iya', 'ya', 'oke', 'ok', 'baik', 'setuju', 'benar', 'tentu', 'sependapat', 'betul', 'sepakat', 'sip', 'deal'], g: 'ok' },
    { words: ['tolong', 'bantu', 'mohon', 'silakan', 'silahkan', 'biarkan'], g: 'ok' },
    { words: ['terimakasih', 'makasih', 'trims', 'thanks', 'terimakasihbanyak', 'terimakasihkembali', 'sama'], g: 'namaste' },
    { words: ['sukses', 'juara', 'puji', 'syukur', 'bangga', 'senang', 'terbaik', 'excellent', 'luarbiasa', 'prestasi', 'berhasil'], g: 'thumbup' },
    { words: ['bagus', 'hebat', 'mantap', 'keren', 'indah', 'cantik', 'baik', 'suka', 'indah', 'elok', 'menarik'], g: 'thumbup' },
    { words: ['jelek', 'buruk', 'parah', 'payah', 'bodoh', 'gagal', 'salah', 'keliru', 'rugi', 'malas', 'kurangbaik'], g: 'thumbdown' },
    { words: ['penting', 'utama', 'besar', 'nomorsatu', 'prioritas', 'krusial', 'vital'], g: 'handup' },
    { words: ['seru', 'wow', 'dahsyat', 'amazing', 'fantastis', 'sungguh', 'luarbiasa'], g: 'handup' },
    { words: ['pertama', 'kedua', 'ketiga', 'terakhir', 'berikutnya', 'selanjutnya', 'tambahan'], g: 'index' },
    { words: ['?'], g: 'shrug' },
]

const POSITIVE_WORDS = ['bagus', 'hebat', 'mantap', 'senang', 'sukses', 'indah', 'baik', 'suka', 'berhasil', 'luarbiasa', 'keren', 'cinta', 'bangga', 'syukur', 'tumbuh', 'lancar', 'antusias', 'tinggi', 'terima']
const NEGATIVE_WORDS = ['jelek', 'buruk', 'parah', 'gagal', 'rugi', 'malas', 'bodoh', 'salah', 'keliru', 'sedih', 'kecewa', 'marah', 'benci', 'takut']
const QUESTION_WORDS = ['apa', 'siapa', 'kenapa', 'mengapa', 'bagaimana', 'kapan', 'berapa', 'dimana', 'kemana', 'darimana', 'apakah']

function detectMood(text) {
    if (/[?？]/g.test(text)) {
        const qCount = (text.match(/[?？]/g) || []).length
        if (qCount > 1) return 'excited'
        if (QUESTION_WORDS.some(w => text.toLowerCase().includes(w))) return 'excited'
    }
    if (/[!！]/g.test(text)) return 'excited'
    if (text.includes('😊') || text.includes('😄') || text.includes('🥰') || text.includes('😁') || text.includes('😂')) return 'happy'
    if (text.includes('😢') || text.includes('😭') || text.includes('😞') || text.includes('🥺')) return 'sad'
    if (text.includes('😡') || text.includes('🤬') || text.includes('😤') || text.includes('😠')) return 'angry'

    const lower = text.toLowerCase()
    let posScore = 0, negScore = 0
    for (const w of POSITIVE_WORDS) {
        if (lower.includes(w)) posScore++
    }
    for (const w of NEGATIVE_WORDS) {
        if (lower.includes(w)) negScore++
    }
    if (posScore > negScore && posScore >= 2) return 'happy'
    if (negScore > posScore) return 'sad'
    return 'neutral'
}

export function keywordFallback(text, words) {
    const gestures = []
    const lower = text.toLowerCase()
    const wordList = words || lower.split(/\s+/).filter(w => w.length > 0)
    if (wordList.length === 0) return { mood: 'neutral', gestures: [] }

    const mood = detectMood(text)
    const usedIndices = new Set()
    const total = wordList.length

    function isProperNoun(raw, idx) {
        if (idx === 0) return false
        return /^[A-Z]/.test(raw) && !/^[A-Z]/.test(wordList[0])
    }

    function hasNumber(w) {
        return /\d/.test(w)
    }

    function isStopWord(w) {
        return ['dan', 'atau', 'yang', 'di', 'ke', 'dari', 'dgn', 'dengan', 'untuk', 'pada', 'ini', 'itu', 'oleh', 'sebagai', 'secara', 'serta', 'agar', 'supaya', 'telah', 'sudah', 'sedang', 'akan', 'bisa', 'dapat', 'juga', 'saja', 'tapi', 'namun', 'tetapi', 'sedangkan', 'sementara', 'sangat', 'paling', 'para', 'si', 'se'].includes(w)
    }

    function isAdjOrAdv(w) {
        return ['sangat', 'paling', 'lebih', 'kurang', 'cukup', 'agak', 'semakin', 'makin'].includes(w)
    }

    const matchedWords = new Map()
    for (let i = 0; i < total; i++) {
        const raw = wordList[i]
        const w = cleanWord(raw)
        if (!w || isStopWord(w) || isAdjOrAdv(w)) continue

        for (const rule of KEYWORD_MAP) {
            if (rule.words.includes(w)) {
                if (!matchedWords.has(i)) matchedWords.set(i, { word: raw, gesture: rule.g })
                break
            }
        }
    }

    const gapMin = 2
    const sortedEntries = [...matchedWords.entries()]
    const selected = []
    for (const [idx, data] of sortedEntries) {
        if (selected.length > 0 && idx - selected[selected.length - 1].idx <= gapMin) continue
        selected.push({ ...data, idx })
    }

    if (selected.length >= 2) {
        for (const s of selected) {
            usedIndices.add(s.idx)
            const importance = s.idx === 0 || s.idx === total - 1 ? 1.3 : 1
            const dur = Math.min(2.5, Math.max(1.2, 1.2 + Math.random() * 0.8 * importance))
            gestures.push({ word: s.word, gesture: s.gesture, duration: Math.round(dur * 10) / 10 })
        }
    }

    if (gestures.length < 3 && total >= 6) {
        const sections = [
            { start: 0, end: Math.floor(total / 3) },
            { start: Math.floor(total / 3), end: Math.floor(2 * total / 3) },
            { start: Math.floor(2 * total / 3), end: total },
        ]
        for (const sec of sections) {
            if (gestures.length >= 3) break
            const candidates = []
            for (let i = sec.start; i < sec.end && i < total; i++) {
                if (usedIndices.has(i)) continue
                const raw = wordList[i]
                const w = cleanWord(raw)
                if (!w || isStopWord(w)) continue

                let gesture = null
                let priority = 0

                if (hasNumber(w)) { gesture = 'handup'; priority = 3 }
                else if (isProperNoun(raw, i)) { gesture = 'index'; priority = 3 }
                else if (i === sec.start || i === sec.end - 1 || i === Math.floor((sec.start + sec.end) / 2)) {
                    const pick = ['handup', 'side', 'ok']
                    gesture = pick[Math.floor(Math.random() * pick.length)]
                    priority = 1
                }

                if (gesture && priority > 0) {
                    candidates.push({ idx: i, word: raw, gesture, priority })
                }
            }
            candidates.sort((a, b) => b.priority - a.priority)
            if (candidates.length > 0) {
                const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 2))]
                if (pick) {
                    usedIndices.add(pick.idx)
                    const dur = pick.priority >= 3
                        ? Math.round((1.8 + Math.random() * 0.7) * 10) / 10
                        : Math.round((1.2 + Math.random() * 0.6) * 10) / 10
                    gestures.push({ word: pick.word, gesture: pick.gesture, duration: dur })
                }
            }
        }
    }

    if (gestures.length === 0) {
        const mid = Math.floor(total / 3)
        if (mid < total && wordList[mid]) {
            const pick = ['handup', 'side', 'ok']
            gestures.push({ word: wordList[mid], gesture: pick[Math.floor(Math.random() * pick.length)], duration: 2 })
        }
    }

    return { mood, gestures }
}

export async function analyzeTextWithGemini(text, model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const prompt = `Kamu adalah sutradara gestur untuk avatar 3D presenter Bahasa Indonesia.

Analisis teks berikut dan tentukan gestur tangan yang natural untuk kata-kata kunci SAJA (jangan semua kata, pilih yg penting).

Pilihan gestur:
- handup = melambai/mengangkat tangan (salam, seru, emphasis)
- index = menunjuk (saya/aku/kamu/ini/itu)
- ok = tanda OK (setuju, ya, baik)
- thumbup = jempol (bagus, hebat, mantap, positif)
- thumbdown = jempol turun (jelek, buruk, negatif)
- side = menunjuk samping (dia, mereka, sana, situ)
- shrug = angkat bahu (tidak tahu, mungkin, bingung, ?)
- ok = tanda OK (juga untuk: terima kasih, hormat, mohon)
- namaste = tangan bersedekap (hormat, terima kasih, salam)

Tentukan mood: neutral | happy | excited | sad | angry

Output JSON SAJA tanpa markdown, tanpa penjelasan:
{"mood":"neutral","gestures":[{"word":"Kata","gesture":"handup","duration":2},{"word":"Saya","gesture":"index","duration":1.5}]}

Jangan beri gestur untuk kata sambung (dan, atau, yang, di, ke, dari, dll) atau kata sifat umum.
Beri jeda alami: jangan 2 gestur berurutan tanpa jeda minimal 1 kata di antaranya.

Teks: ${text}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
            }),
            signal: controller.signal
        })
        clearTimeout(timeout)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
        const data = await resp.json()
        const parts = data?.candidates?.[0]?.content?.parts
        const raw = Array.isArray(parts) ? parts.map(p => p.text).filter(Boolean).join('') : null
        if (!raw) throw new Error('Gemini: empty response')
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        return JSON.parse(cleaned)
    } catch (e) {
        clearTimeout(timeout)
        if (e.name === 'AbortError') throw new Error('Timeout')
        throw e
    }
}

export async function getGestureSchedule(text) {
    if (GESTURE_CACHE.has(text)) return GESTURE_CACHE.get(text)
    const words = text.split(/\s+/).filter(w => w.length > 0)
    let result, lastErr
    for (const model of GEMINI_MODELS) {
        try { result = await analyzeTextWithGemini(text, model); lastErr = null; break }
        catch (e) { lastErr = e; console.warn(`Gemini ${model} failed:`, e.message || e) }
    }
    if (!result || !Array.isArray(result.gestures)) {
        if (lastErr) console.warn('All Gemini models failed, using fallback:', lastErr.message || lastErr)
        result = keywordFallback(text, words)
    }
    GESTURE_CACHE.set(text, result)
    return result
}
