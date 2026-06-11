import { state } from './state.js'
import { VOWEL_VISEME_MAP, MOOD_EXPRESSION } from './constants.js'
import { autoResizeTextarea, cleanWord } from './utils.js'
import { synth, initAudioControls } from './audio.js'
import { getGestureSchedule } from './ai.js'
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

// Initialize audio
initAudioControls(voiceSelect, voiceStatus, rateSlider, rateLabel, speakBtn)
textInput.addEventListener('input', () => autoResizeTextarea(textInput))
autoResizeTextarea(textInput)

function setSpeaking(speaking) {
    state.isSpeaking = speaking
    if (speaking) {
        speakBtn.innerHTML = '&#9632; Berhenti'
        stopIdleAnimation()
        startMorphLerp()
        if (state.avatarReady) startMouthAnimation()
    } else {
        speakBtn.innerHTML = '&#9654; Bicara'
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
    speakBtn.innerHTML = 'Menganalisis...'
    speakBtn.disabled = true

    const schedule = await getGestureSchedule(text)
    state.gestureSchedule = schedule.gestures || []

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
    if (state.selectedVoice) { utterance.voice = state.selectedVoice; utterance.lang = state.selectedVoice.lang }
    else utterance.lang = 'id-ID'
    utterance.rate = Math.round(parseFloat(rateSlider.value) * 10) / 10 || 1.0
    utterance.pitch = 1.0; utterance.volume = 1.0

    const words = text.split(/\s+/).filter(w => w.length > 0)

    utterance.onstart = () => {
        state.speechStartTime = Date.now()
        state.lastBoundaryTime = Date.now()
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
        state.lastBoundaryTime = Date.now()
        if (e.name === 'word') {
            let spoken = ''
            try { spoken = cleanWord(text.substring(e.charIndex, e.charIndex + e.charLength)) } catch { return }
            if (!spoken) return
            const match = state.gestureSchedule.find(g => cleanWord(g.word) === spoken)
            if (match && state.head && state.head.playGesture) {
                try { state.head.playGesture(match.gesture, match.duration || 2) }
                catch (e) { console.warn('playGesture failed:', e) }
            }
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
    if (!text) textInput.focus()
    else await speakText(text)
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

        if (state.isSpeaking) startMouthAnimation()
        else startIdleAnimation()
        
    } catch(err) {
        loadingEl.textContent = 'Gagal muat avatar: ' + (err.message || err)
        loadingEl.style.color = '#ff6b6b'
        console.error('Avatar failed:', err)
    }
}

initAvatar()
