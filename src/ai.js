import { GEMINI_KEY, GEMINI_MODELS } from './constants.js'
import { cleanWord } from './utils.js'

const GESTURE_CACHE = new Map()

export function keywordFallback(text, words) {
    const gestures = []
    const lower = text.toLowerCase()
    const wordList = words || lower.split(/\s+/).filter(w => w.length > 0)
    const map = [
        { words: ['halo', 'hai', 'selamat', 'assalamualaikum', 'selamatpagi', 'selamatsiang', 'selamatmalam'], g: 'handup' },
        { words: ['salam', 'hormatsaya'], g: 'namaste' },
        { words: ['saya', 'aku', 'kami', 'kitah', 'gue', 'gw'], g: 'index' },
        { words: ['kamu', 'anda', 'kau', 'dikau', 'lu', 'elo'], g: 'side' },
        { words: ['tidak', 'bukan', 'jangan', 'nggak', 'ga', 'gak', 'tak'], g: 'shrug' },
        { words: ['iya', 'ya', 'oke', 'ok', 'baik', 'setuju', 'benar', 'tentu'], g: 'ok' },
        { words: ['bagus', 'hebat', 'mantap', 'keren', 'indah', 'cantik', 'baik', 'senang', 'suka'], g: 'thumbup' },
        { words: ['jelek', 'buruk', 'parah', 'payah', 'bodoh', 'tidakbaik'], g: 'thumbdown' },
        { words: ['terimakasih', 'makasih', 'trims', 'thanks', 'hormat', 'terimakasihbanyak'], g: 'namaste' },
        { words: ['mungkin', 'kurangtahu', 'bingung', 'entah', 'terserah'], g: 'shrug' },
        { words: ['tolong', 'bantu', 'mohon', 'silakan', 'silahkan'], g: 'ok' },
    ]
    let mood = 'neutral'
    if (/[?？]/.test(text)) mood = 'excited'
    if (text.includes('😊') || text.includes('😄') || text.includes('🥰')) mood = 'happy'
    if (text.includes('😢') || text.includes('😭') || text.includes('😞')) mood = 'sad'
    if (text.includes('😡') || text.includes('🤬') || text.includes('😤')) mood = 'angry'
    const seenIndices = new Set()
    for (let i = 0; i < wordList.length; i++) {
        const w = cleanWord(wordList[i]); if (!w || seenIndices.has(i)) continue
        for (const rule of map) {
            if (rule.words.includes(w)) {
                gestures.push({ word: wordList[i], gesture: rule.g, duration: 1.5 + Math.random() })
                seenIndices.add(i); break
            }
        }
        if (i > 0 && i < wordList.length - 1 && /[?？]/.test(wordList[i])) {
            gestures.push({ word: wordList[i], gesture: 'shrug', duration: 1.5 })
        }
    }
    if (gestures.length === 0 && wordList.length > 0) {
        const pick = ['handup', 'side', 'shrug']
        const mid = Math.floor(wordList.length / 3)
        if (wordList[mid]) gestures.push({ word: wordList[mid], gesture: pick[Math.floor(Math.random() * pick.length)], duration: 2 })
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
