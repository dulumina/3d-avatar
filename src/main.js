import { state } from './state.js'
import { VOWEL_VISEME_MAP, MOOD_EXPRESSION } from './constants.js'
import { autoResizeTextarea, cleanWord } from './utils.js'
import { synth, initAudioControls } from './audio.js'
import { getGestureSchedule, generateChatResponse } from './ai.js'
import { 
    buildMorphMap, 
    setMorphMap, 
    findAvatarRoot, 
    startMorphLerp, 
    morphMap,
    collectExpressionMorphs,
    setMoodExpression,
} from './animation/morph.js'
import { buildMouthTimeline } from './animation/timeline.js'
import { 
    startIdleAnimation, 
    stopIdleAnimation, 
    startMouthAnimation, 
    stopMouthAnimation 
} from './animation/mouth.js'
import { TalkingHead } from '@met4citizen/talkinghead'

// --- DOM Elements ---
const container = document.getElementById('avatar-container')
const loadingEl = document.createElement('div')
loadingEl.id = 'loading-indicator'
loadingEl.textContent = 'Memuat avatar...'
container.appendChild(loadingEl)

const textInput = document.getElementById('text-input')
const speakBtn = document.getElementById('speak-btn')
const voiceSelect = document.getElementById('voice-select')
const voiceStatus = document.getElementById('voice-status')
const rateSlider = document.getElementById('rate-slider')
const rateLabel = document.getElementById('rate-label')
const settingsBtn = document.getElementById('settings-btn')
const settingsModal = document.getElementById('settings-modal')
const currentMessage = document.getElementById('current-message')

settingsBtn.addEventListener('click', () => {
    settingsModal.classList.toggle('hidden')
})

// Initialize audio
initAudioControls(voiceSelect, voiceStatus, rateSlider, rateLabel, speakBtn)
textInput.addEventListener('input', () => autoResizeTextarea(textInput))
autoResizeTextarea(textInput)

function setSpeaking(speaking) {
    state.isSpeaking = speaking
    if (speaking) {
        speakBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="6" width="12" height="12"></rect></svg>'
        stopIdleAnimation()
        startMorphLerp()
        if (state.avatarReady) {
            startMouthAnimation()
            if (state.head && state.head.poseTemplates) {
                state.head.setPoseFromTemplate(state.head.poseTemplates['straight'])
            }
        }
    } else {
        speakBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>'
    }
}

function stopAll() {
    if (state.chromeKeepAliveInterval) { clearInterval(state.chromeKeepAliveInterval); state.chromeKeepAliveInterval = null }
    if (synth) synth.cancel()
    setSpeaking(false)
    stopMouthAnimation()
    if (state.head && state.head.stopGesture) state.head.stopGesture(500)
    state.currentMood = 'neutral'
    setMoodExpression('neutral')
    if (state.head && state.head.setMood) state.head.setMood('neutral')
}

async function speakText(text) {
    if (!synth) { console.warn('SpeechSynthesis not available'); return }
    if (!text) return
    if (synth.speaking) { stopAll(); return }
    if (state.isAnalyzing) return

    state.isAnalyzing = true
    speakBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" class="spinner"></path></svg>'
    speakBtn.disabled = true

    const words = text.split(/\s+/).filter(w => w.length > 0)
    const schedule = await getGestureSchedule(text)
    state.gestureSchedule = schedule.gestures || []
    console.log('[GESTURE] schedule dari AI:', JSON.stringify(state.gestureSchedule))

    state.gestureWordMap = new Map()
    for (const g of state.gestureSchedule) {
        const cleanTarget = cleanWord(g.word)
        const idx = words.findIndex(w => cleanWord(w) === cleanTarget)
        if (idx >= 0) {
            console.log('[GESTURE] map wordIndex:', idx, '->', g.gesture, '(word:', g.word, ')')
            state.gestureWordMap.set(idx, g)
        } else {
            console.warn('[GESTURE] kata tidak ditemukan di teks:', g.word)
        }
    }

    state.isAnalyzing = false
    speakBtn.disabled = false

    if (Object.keys(morphMap).length === 0 && state.head) {
        const root = findAvatarRoot()
        setMorphMap(buildMorphMap(root))
        const keys = Object.keys(morphMap)
        if (keys.length > 0) {
            const jawKey = keys.find(k => /^jawOpen$/i.test(k)) || keys.find(k => /jaw|mouth/i.test(k))
            if (jawKey) state.jawMorphName = jawKey
            for (const [vowel, cfg] of Object.entries(VOWEL_VISEME_MAP)) {
                if (keys.includes(cfg.morph)) state.visemeMorphNames[vowel] = cfg.morph
            }
        }
    }

    if (schedule.mood) {
        state.currentMood = schedule.mood
        setMoodExpression(schedule.mood)
        if (state.head && state.head.setMood) state.head.setMood(schedule.mood)
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'id-ID' // Paksa selalu gunakan bahasa Indonesia
    
    let targetVoice = null;
    
    // Jika ada suara yang terpilih di state dan itu adalah suara bahasa Indonesia
    if (state.selectedVoice && (state.selectedVoice.lang.startsWith('id') || /indonesia/i.test(state.selectedVoice.name))) { 
        targetVoice = state.selectedVoice 
    } else {
        // Coba ambil list suara terbaru (karena di HP kadang voice telat ter-load)
        const voices = window.speechSynthesis.getVoices()
        // Coba cari Veronika/Damayanti/Female dulu
        targetVoice = voices.find(v => (v.lang.startsWith('id') || /indonesia/i.test(v.name)) && /veronika|damayanti|female|gadis/i.test(v.name))
        // Jika tidak ada, ambil suara Indonesia apa saja
        if (!targetVoice) {
            targetVoice = voices.find(v => v.lang.startsWith('id') || /indonesia/i.test(v.name))
        }
    }
    
    if (targetVoice) {
        utterance.voice = targetVoice
    }
    
    utterance.rate = Math.round(parseFloat(rateSlider.value) * 10) / 10 || 1.0
    utterance.pitch = 1.0; utterance.volume = 1.0

    utterance.onstart = () => {
        state.speechStartTime = Date.now()
        const rate = utterance.rate || 1
        state.mouthTimeline = buildMouthTimeline(words, rate)
        setSpeaking(true)
    }
    utterance.onend = () => {
        if (state.chromeKeepAliveInterval) { clearInterval(state.chromeKeepAliveInterval); state.chromeKeepAliveInterval = null }
        setSpeaking(false)
        stopMouthAnimation()
        state.currentMood = 'neutral'
        setMoodExpression('neutral')
        if (state.head && state.head.setMood) state.head.setMood('neutral')
    }
    utterance.onerror = (e) => {
        console.error('TTS error:', e.error)
        if (state.chromeKeepAliveInterval) { clearInterval(state.chromeKeepAliveInterval); state.chromeKeepAliveInterval = null }
        setSpeaking(false)
        stopMouthAnimation()
        state.currentMood = 'neutral'
        setMoodExpression('neutral')
        if (state.head && state.head.setMood) state.head.setMood('neutral')
    }

    utterance.onboundary = (e) => {
        const wordIdx = text.substring(0, e.charIndex).split(/\s+/).filter(w => w.length > 0).length
        console.log('[GESTURE] onboundary event name:', e.name, 'wordIdx:', wordIdx, 'charIndex:', e.charIndex)
        const match = state.gestureWordMap.get(wordIdx)
        if (match) {
            if (state.head && state.head.armature && state.head.playGesture) {
                console.log('[GESTURE] -> memainkan', match.gesture, 'durasi', match.duration)
                try { state.head.playGesture(match.gesture, match.duration || 2) }
                catch (e) { console.warn('[GESTURE] playGesture error:', e) }
            } else {
                console.warn('[GESTURE] -> head/armature belum siap, skip gesture')
            }
        } else {
            console.log('[GESTURE] -> tidak ada jadwal di index ini')
        }
    }

    synth.speak(utterance)

    if (state.chromeKeepAliveInterval) clearInterval(state.chromeKeepAliveInterval)
    state.chromeKeepAliveInterval = setInterval(() => {
        if (!synth.speaking) { clearInterval(state.chromeKeepAliveInterval); state.chromeKeepAliveInterval = null; return }
        synth.pause()
        synth.resume()
    }, 10000)
}

function resumeAudio() {
    try { if (state.head && state.head.audioCtx && state.head.audioCtx.state === 'suspended') state.head.audioCtx.resume() } catch (e) { }
}

document.addEventListener('click', resumeAudio, { once: true })

speakBtn.addEventListener('click', async () => {
    resumeAudio()
    const text = textInput.value.trim()
    if (!text) {
        textInput.focus()
        return
    }
    
    // Disable input and button while thinking
    textInput.disabled = true
    speakBtn.disabled = true
    
    // UI update to show thinking state
    const originalText = currentMessage.textContent
    currentMessage.textContent = "Sedang berpikir..."
    textInput.value = ''
    autoResizeTextarea(textInput)
    
    // Add user message to history
    state.chatHistory.push({ role: 'user', parts: [{ text: text }] })
    
    // Keep history manageable (e.g., last 10 turns)
    if (state.chatHistory.length > 20) {
        state.chatHistory = state.chatHistory.slice(state.chatHistory.length - 20)
    }

    try {
        const aiResponse = await generateChatResponse(text, state.chatHistory)
        
        // Update history with AI response
        state.chatHistory.push({ role: 'model', parts: [{ text: aiResponse }] })
        
        // Show AI response in bubble
        currentMessage.textContent = aiResponse
        
        // Speak the response
        await speakText(aiResponse)
    } catch (e) {
        console.error("Failed to generate response:", e)
        currentMessage.textContent = "Maaf, terjadi kesalahan saat memproses pesan Anda."
    } finally {
        textInput.disabled = false
        speakBtn.disabled = false
        textInput.focus()
    }
})
textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); speakBtn.click() }
})

// Initialize TalkingHead
async function initAvatar() {
    state.head = new TalkingHead(container, {
        ttsEndpoint: '',
        cameraView: 'mid', cameraRotateEnable: false, cameraZoomEnable: false, cameraPanEnable: false,
        lightAmbientIntensity: 2.5, lightDirectIntensity: 25,
        lipsyncModules: [],
    })
    
    try {
        await state.head.showAvatar({
            url: 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@main/avatars/avaturn.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown',
            body: true, ttsLang: 'id-ID', lipsyncLang: 'id-ID', baseline: 1.6,
        })
        
        state.avatarReady = true
        loadingEl.remove()
        startMorphLerp()

        const root = findAvatarRoot()
        setMorphMap(buildMorphMap(root))
        const mtKeys = state.head.mtAvatar ? Object.keys(state.head.mtAvatar) : []
        const morphMapKeys = Object.keys(morphMap)
        const keys = (mtKeys.length > 0 ? mtKeys : morphMapKeys).sort()
        
        const jawKey = keys.find(k => /^jawOpen$/i.test(k))
            || keys.find(k => /^mouthOpen$/i.test(k))
            || keys.find(k => /jaw|mouth/i.test(k) && !/viseme|eye|brow|cheek|nostril|tongue|forward|left|right|smile|frown/i.test(k))
            || keys.find(k => /jaw|mouth/i.test(k))
        state.jawMorphName = jawKey || null

        for (const [vowel, cfg] of Object.entries(VOWEL_VISEME_MAP)) {
            if (keys.includes(cfg.morph)) state.visemeMorphNames[vowel] = cfg.morph
        }

        state.expressionMorphNames = collectExpressionMorphs()
        setMoodExpression('neutral')

        if (state.head && state.head.poseTemplates) {
            state.head.setPoseFromTemplate(state.head.poseTemplates['straight'], 100)
        }

        if (state.isSpeaking) startMouthAnimation()
        else startIdleAnimation()
        
    } catch(err) {
        loadingEl.textContent = 'Gagal muat avatar: ' + (err.message || err)
        loadingEl.style.color = '#ff6b6b'
        console.error('Avatar failed:', err)
    }
}

initAvatar()
