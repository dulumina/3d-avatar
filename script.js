const container = document.getElementById('avatar-container')
const loadingEl = document.createElement('div')
loadingEl.id = 'loading-indicator'
loadingEl.textContent = 'Memuat avatar...'
container.appendChild(loadingEl)

let head = null
let avatarReady = false
let jawMorphName = null
let visemeMorphNames = {}
let isSpeaking = false
let mouthActive = false
let isAnalyzing = false
let mouthAnimFrame = null
let speechStartTime = 0
let mouthTimeline = []
let lastGestureIdx = -1
let lastVisemeName = null
let availableVoices = []
let selectedVoice = null
let voicesReady = false
let currentWordIndex = 0
let gestureSchedule = []

const synth = window.speechSynthesis
const textInput = document.getElementById('text-input')
const speakBtn = document.getElementById('speak-btn')
const voiceSelect = document.getElementById('voice-select')
const voiceStatus = document.getElementById('voice-status')
const rateSlider = document.getElementById('rate-slider')
const rateLabel = document.getElementById('rate-label')
const VOICE_STORAGE_KEY = 'ai-avatar-voice'
const RATE_STORAGE_KEY = 'ai-avatar-rate'

const GEMINI_KEY = 'GEMINI_KEY_REMOVED'
const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash']
const GESTURE_CACHE = new Map()

const GESTURES = ['handup', 'index', 'ok', 'thumbup', 'thumbdown', 'side', 'shrug', 'namaste']

const VOWEL_VISEME_MAP = {
    a: { morph: 'viseme_aa', jaw: 0.7 },
    i: { morph: 'viseme_I', jaw: 0.35 },
    u: { morph: 'viseme_U', jaw: 0.5 },
    e: { morph: 'viseme_E', jaw: 0.45 },
    o: { morph: 'viseme_O', jaw: 0.55 }
}

function autoResizeTextarea() {
    textInput.style.height = 'auto'
    textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px'
}
textInput.addEventListener('input', autoResizeTextarea)

function isIndonesianVoice(voice) {
    return voice.lang.startsWith('id') || /indonesia/i.test(voice.name)
}

function sortVoiceByPriority(voices) {
    return [...voices].sort((a, b) => {
        const aId = isIndonesianVoice(a); const bId = isIndonesianVoice(b)
        if (aId && !bId) return -1; if (!aId && bId) return 1
        if (aId && bId) {
            if (/google/i.test(a.name)) return -1; if (/google/i.test(b.name)) return 1
            if (/microsoft/i.test(a.name)) return -1; if (/microsoft/i.test(b.name)) return 1
        }
        return a.name.localeCompare(b.name)
    })
}

function populateVoiceSelector(voices) {
    if (!voices || voices.length === 0) return
    const sorted = sortVoiceByPriority(voices)
    availableVoices = sorted; voiceSelect.innerHTML = ''; const seen = new Set()
    for (const voice of sorted) {
        const key = voice.name + voice.lang; if (seen.has(key)) continue; seen.add(key)
        const option = document.createElement('option')
        option.value = voice.name + '||' + voice.lang
        const label = voice.name + (voice.lang ? ` (${voice.lang})` : '')
        option.textContent = isIndonesianVoice(voice) ? '🇮🇩 ' + label : label
        if (isIndonesianVoice(voice)) option.dataset.indonesian = 'true'
        voiceSelect.appendChild(option)
    }
    if (voiceSelect.options.length === 0) { voiceStatus.textContent = 'Tidak ada suara tersedia'; voiceStatus.className = 'error'; return }
    const savedVoiceName = localStorage.getItem(VOICE_STORAGE_KEY)
    let selectedIndex = -1
    if (savedVoiceName) for (let i = 0; i < voiceSelect.options.length; i++) { if (voiceSelect.options[i].value.startsWith(savedVoiceName)) { selectedIndex = i; break } }
    if (selectedIndex === -1) for (let i = 0; i < voiceSelect.options.length; i++) { if (voiceSelect.options[i].dataset.indonesian === 'true') { selectedIndex = i; break } }
    if (selectedIndex === -1) selectedIndex = 0
    voiceSelect.selectedIndex = selectedIndex; updateSelectedVoice(); voiceSelect.disabled = false
    const idCount = sorted.filter(v => isIndonesianVoice(v)).length
    voiceStatus.textContent = idCount > 0 ? idCount + ' suara Indonesia tersedia' : 'Suara Indonesia tidak tersedia'
    voiceStatus.className = idCount > 0 ? 'loaded' : 'error'; voicesReady = true
}

function updateSelectedVoice() {
    const val = voiceSelect.value; if (!val) { selectedVoice = null; return }
    const [name, lang] = val.split('||')
    selectedVoice = availableVoices.find(v => v.name === name && v.lang === lang) || null
    if (selectedVoice) localStorage.setItem(VOICE_STORAGE_KEY, selectedVoice.name)
}
voiceSelect.addEventListener('change', updateSelectedVoice)

function loadVoices() {
    const voices = synth.getVoices()
    if (voices && voices.length > 0) { populateVoiceSelector(voices); return true }
    return false
}

if (synth) {
    synth.addEventListener('voiceschanged', () => { loadVoices() })
    if (!loadVoices()) { const r = setInterval(() => { if (loadVoices()) clearInterval(r) }, 200); setTimeout(() => clearInterval(r), 5000) }
} else {
    voiceStatus.textContent = 'Browser tidak mendukung Speech Synthesis'; voiceStatus.className = 'error'; speakBtn.disabled = true
}

rateSlider.addEventListener('input', () => {
    const val = Math.round(parseFloat(rateSlider.value) * 10) / 10
    rateLabel.textContent = val.toFixed(1) + 'x'; localStorage.setItem(RATE_STORAGE_KEY, val.toFixed(1))
})
const savedRate = localStorage.getItem(RATE_STORAGE_KEY)
if (savedRate) { rateSlider.value = savedRate; rateLabel.textContent = parseFloat(savedRate).toFixed(1) + 'x' }

function setMorph(name, val) {
    const mt = head && head.mtAvatar
    if (!mt || !name || !mt[name]) return
    if (val > 0) mt[name].fixed = val; else mt[name].fixed = null
    mt[name].needsUpdate = true
}

function setJawOpen(val) { setMorph(jawMorphName, val) }

function animateMouthElapsed() {
    if (!mouthActive) { stopMouthAnimation(); return }
    if (mouthTimeline.length === 0) { mouthActive = false; stopMouthAnimation(); return }
    const elapsed = Date.now() - speechStartTime

    let current = null
    let curIdx = -1
    for (let i = 0; i < mouthTimeline.length; i++) {
        const e = mouthTimeline[i]
        if (elapsed >= e.time && elapsed < e.endTime) { current = e; curIdx = i; break }
    }

    if (!current) {
        if (mouthTimeline.length > 0 && elapsed > mouthTimeline[mouthTimeline.length - 1].endTime + 400) {
            stopMouthAnimation(); if (head && head.stopGesture) head.stopGesture(500); return
        }
        if (lastGestureIdx >= 0) { setMorph(lastVisemeName, 0); lastVisemeName = null }
        setJawOpen(0)
        mouthAnimFrame = requestAnimationFrame(animateMouthElapsed)
        return
    }

    if (current.gesture && curIdx !== lastGestureIdx) {
        lastGestureIdx = curIdx
        if (head && head.playGesture) head.playGesture(current.gesture.gesture, current.gesture.duration || 2)
    }

    const t = (elapsed - current.time) / (current.endTime - current.time)
    const env = current.jawOpen > 0 ? (t < 0.25 ? t / 0.25 : (t > 0.5 ? Math.max(0, 1 - (t - 0.5) / 0.5) : 1)) : 0
    const targetOpen = current.jawOpen * env

    const mt = head && head.mtAvatar
    if (mt && jawMorphName && mt[jawMorphName]) {
        if (current.jawOpen === 0) {
            setJawOpen(0)
        } else {
            const cur = mt[jawMorphName].fixed || 0
            setJawOpen(cur + (targetOpen - cur) * 0.7)
        }
    }

    if (current.vowel && visemeMorphNames[current.vowel]) {
        const vn = visemeMorphNames[current.vowel]
        if (lastVisemeName && lastVisemeName !== vn) setMorph(lastVisemeName, 0)
        setMorph(vn, Math.max(0.3, env))
        lastVisemeName = vn
    } else if (lastVisemeName) {
        setMorph(lastVisemeName, 0); lastVisemeName = null
    }

    mouthAnimFrame = requestAnimationFrame(animateMouthElapsed)
}

function startMouthAnimation() {
    if (mouthAnimFrame) cancelAnimationFrame(mouthAnimFrame)
    mouthActive = true
    if (mouthTimeline.length > 0) {
        speechStartTime = Date.now(); lastGestureIdx = -1; lastVisemeName = null
        console.log('MOUTH start at', speechStartTime)
    }
    animateMouthElapsed()
}

function stopMouthAnimation() {
    mouthActive = false
    if (mouthAnimFrame) { cancelAnimationFrame(mouthAnimFrame); mouthAnimFrame = null }
    if (lastVisemeName) { setMorph(lastVisemeName, 0); lastVisemeName = null }
    setJawOpen(0)
    console.log('MOUTH end, total elapsed:', Date.now() - speechStartTime, 'ms')
    mouthTimeline = []
}

function setSpeaking(speaking) {
    isSpeaking = speaking
    if (speaking) {
        speakBtn.innerHTML = '&#9632; Berhenti'
        if (avatarReady) startMouthAnimation()
    } else {
        speakBtn.innerHTML = '&#9654; Bicara'
    }
}

function stopAll() {
    if (synth) synth.cancel()
    setSpeaking(false)
    stopMouthAnimation()
    if (head && head.stopGesture) head.stopGesture(500)
}

function cleanWord(w) { return w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() }

function syllabify(word) {
    if (!word || word.length === 0) return []
    const vowels = 'aiueoAIUEO'
    const syls = []
    let cur = ''
    for (const ch of word) {
        cur += ch
        if (vowels.includes(ch)) { syls.push(cur); cur = '' }
    }
    if (cur) {
        if (syls.length > 0) syls[syls.length - 1] += cur
        else syls.push(cur)
    }
    return syls.filter(s => s.length > 0)
}

function keywordFallback(text, words) {
    const gestures = []
    const lower = text.toLowerCase()
    const wordList = words || lower.split(/\s+/).filter(w => w.length > 0)

    const map = [
        { words: ['halo', 'hai', 'selamat', 'salam', 'assalamualaikum', 'selamatpagi', 'selamatsiang', 'selamatmalam'], g: 'handup' },
        { words: ['saya', 'aku', 'kami', 'kitah', 'gue', 'gw'], g: 'index' },
        { words: ['kamu', 'anda', 'kau', 'dikau', 'lu', 'elo'], g: 'side' },
        { words: ['tidak', 'bukan', 'jangan', 'nggak', 'ga', 'gak', 'tak'], g: 'shrug' },
        { words: ['iya', 'ya', 'oke', 'ok', 'baik', 'setuju', 'benar', 'tentu'], g: 'ok' },
        { words: ['bagus', 'hebat', 'mantap', 'keren', 'indah', 'cantik', 'baik', 'senang', 'suka'], g: 'thumbup' },
        { words: ['jelek', 'buruk', 'parah', 'payah', 'bodoh', 'tidakbaik'], g: 'thumbdown' },
        { words: ['terimakasih', 'makasih', 'trims', 'thanks', 'hormat'], g: 'namaste' },
        { words: ['mungkin', 'kurangtahu', 'bingung', 'entah', 'terserah'], g: 'shrug' },
        { words: ['tolong', 'bantu', 'mohon', 'silakan', 'silahkan'], g: 'namaste' },
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

async function analyzeTextWithGemini(text, model) {
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
- namaste = sembah (terima kasih, hormat, mohon)

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
        if (!raw) throw new Error('Gemini: empty response, full: ' + JSON.stringify(data).slice(0, 200))
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        if (!cleaned) throw new Error('Gemini: empty text after cleanup, raw: ' + raw.slice(0, 200))
        try {
            return JSON.parse(cleaned)
        } catch (parseErr) {
            throw new Error('JSON parse failed: ' + parseErr.message + ' | text: ' + cleaned.slice(0, 200))
        }
    } catch (e) {
        clearTimeout(timeout)
        if (e.name === 'AbortError') throw new Error('Timeout')
        throw e
    }
}

async function getGestureSchedule(text) {
    if (GESTURE_CACHE.has(text)) return GESTURE_CACHE.get(text)

    const words = text.split(/\s+/).filter(w => w.length > 0)
    let result
    let lastErr

    for (const model of GEMINI_MODELS) {
        try {
            result = await analyzeTextWithGemini(text, model)
            lastErr = null
            break
        } catch (e) {
            lastErr = e
            console.warn(`Gemini ${model} failed:`, e.message || e)
        }
    }

    if (!result || !Array.isArray(result.gestures)) {
        if (lastErr) console.warn('All Gemini models failed, using fallback:', lastErr.message || lastErr)
        result = keywordFallback(text, words)
    }
    GESTURE_CACHE.set(text, result)
    return result
}

async function speakText(text) {
    if (!synth) { console.warn('SpeechSynthesis not available'); return }
    if (!text) return
    if (synth.speaking) { stopAll(); return }
    if (isAnalyzing) return

    isAnalyzing = true
    speakBtn.innerHTML = 'Menganalisis...'
    speakBtn.disabled = true

    const schedule = await getGestureSchedule(text)
    gestureSchedule = schedule.gestures || []

    isAnalyzing = false
    speakBtn.disabled = false

    if (schedule.mood && head && head.setMood) head.setMood(schedule.mood)

    const utterance = new SpeechSynthesisUtterance(text)
    if (selectedVoice) { utterance.voice = selectedVoice; utterance.lang = selectedVoice.lang }
    else utterance.lang = 'id-ID'
    utterance.rate = Math.round(parseFloat(rateSlider.value) * 10) / 10 || 1.0
    utterance.pitch = 1.0; utterance.volume = 1.0

    currentWordIndex = 0
    const words = text.split(/\s+/).filter(w => w.length > 0)

    utterance.onstart = () => {
        const rate = utterance.rate || 1
        let cum = 0
        const tl = []
        for (let w = 0; w < words.length; w++) {
            const clean = cleanWord(words[w])
            const cleanLen = clean.length
            const dur = Math.max(100, (120 + cleanLen * 55) / rate)
            const syls = clean ? syllabify(clean) : []
            const sylDur = syls.length > 0 ? dur / syls.length : dur
            const spoken = cleanWord(words[w])
            const gesture = spoken ? gestureSchedule.find(g => cleanWord(g.word) === spoken) : null
            for (let s = 0; s < Math.max(syls.length, 1); s++) {
                const time = cum + s * sylDur
                const sylText = syls.length > 0 ? syls[s] : ''
                const vowelMatch = sylText.match(/[aiueoAIUEO]/)
                const vowel = vowelMatch ? vowelMatch[0].toLowerCase() : null
                const cfg = vowel && VOWEL_VISEME_MAP[vowel] ? VOWEL_VISEME_MAP[vowel] : { jaw: 0.15 }
                const openEnd = time + sylDur * 0.65
                tl.push({ time, endTime: openEnd, jawOpen: cfg.jaw, vowel, gesture: s === 0 ? gesture : null })
                tl.push({ time: openEnd, endTime: time + sylDur, jawOpen: 0, vowel: null, gesture: null })
            }
            cum += dur + 40 / rate
        }
        mouthTimeline = tl
        console.log('SPEECH start, timeline entries:', tl.length, 'total dur:', tl.length > 0 ? tl[tl.length - 1].endTime.toFixed(0) : 0, 'ms')
        setSpeaking(true)
    }
    utterance.onend = () => { console.log('SPEECH end'); setSpeaking(false) }
    utterance.onerror = (e) => { console.error('TTS error:', e.error); setSpeaking(false) }
    utterance.onboundary = (e) => {
        if (e.name === 'word') {
            let spoken = ''
            try { spoken = cleanWord(text.substring(e.charIndex, e.charIndex + e.charLength)) } catch (err) { return }
            if (!spoken) return
            const match = gestureSchedule.find(g => cleanWord(g.word) === spoken)
            if (match && head && head.playGesture) {
                head.playGesture(match.gesture, match.duration || 2)
            }
        }
    }

    synth.speak(utterance)
}

function resumeAudio() {
    try { if (head && head.audioCtx && head.audioCtx.state === 'suspended') head.audioCtx.resume() } catch (e) { }
}

document.addEventListener('click', resumeAudio, { once: true })

speakBtn.addEventListener('click', async () => {
    resumeAudio()
    const text = textInput.value.trim()
    if (!text) textInput.focus()
    else await speakText(text)
})
textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); speakBtn.click() }
})
autoResizeTextarea()

import('https://cdn.jsdelivr.net/npm/@met4citizen/talkinghead@1.7.0/modules/talkinghead.mjs').then(({ TalkingHead }) => {
    head = new TalkingHead(container, {
        ttsEndpoint: '', avatarMute: true,
        cameraRotateEnable: false, cameraZoomEnable: false, cameraPanEnable: false,
        lightAmbientIntensity: 2.5, lightDirectIntensity: 25,
    })
    return head.showAvatar({
        // url: 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@v1.7.0/avatars/brunette.glb',
        url: 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@main/avatars/avaturn.glb',
        body: true, ttsLang: 'id-ID', lipsyncLang: 'id-ID', baseline: 1.6,
    })
}).then(() => {
    avatarReady = true; loadingEl.remove()
    const mt = head.mtAvatar || {}; const keys = Object.keys(mt).sort()
    const jawKey = keys.find(k => /^jawOpen$/i.test(k)) || keys.find(k => /^mouthOpen$/i.test(k)) || keys.find(k => /jaw|mouth/i.test(k) && !/viseme|eye|brow|cheek|nostril|tongue|forward|left|right/i.test(k))
    if (jawKey) { jawMorphName = jawKey }
    else { jawMorphName = keys.find(k => /jaw|mouth/i.test(k)); if (jawMorphName) console.warn('Jaw morph (fallback):', jawMorphName) }
    for (const [vowel, cfg] of Object.entries(VOWEL_VISEME_MAP)) {
        if (keys.includes(cfg.morph)) visemeMorphNames[vowel] = cfg.morph
    }
    if (Object.keys(visemeMorphNames).length > 0) console.log('Viseme morphs:', visemeMorphNames)
    if (isSpeaking) startMouthAnimation()
}).catch(err => {
    loadingEl.textContent = 'Gagal muat avatar: ' + (err.message || err)
    loadingEl.style.color = '#ff6b6b'; console.error('Avatar failed:', err)
})
