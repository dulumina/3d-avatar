import { state } from './state.js'

export const synth = window.speechSynthesis
const VOICE_STORAGE_KEY = 'ai-avatar-voice'
const RATE_STORAGE_KEY = 'ai-avatar-rate'

export function isIndonesianVoice(voice) {
    return voice.lang.startsWith('id') || /indonesia/i.test(voice.name)
}

export function sortVoiceByPriority(voices) {
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

export function updateSelectedVoice(voiceSelect) {
    const val = voiceSelect.value; 
    if (!val) { state.selectedVoice = null; return }
    const [name, lang] = val.split('||')
    state.selectedVoice = state.availableVoices.find(v => v.name === name && v.lang === lang) || null
    if (state.selectedVoice) localStorage.setItem(VOICE_STORAGE_KEY, state.selectedVoice.name)
}

export function populateVoiceSelector(voices, voiceSelect, voiceStatus) {
    if (!voices || voices.length === 0) return
    const sorted = sortVoiceByPriority(voices)
    state.availableVoices = sorted
    voiceSelect.innerHTML = ''
    const seen = new Set()
    
    for (const voice of sorted) {
        const key = voice.name + voice.lang; 
        if (seen.has(key)) continue; 
        seen.add(key)
        
        const option = document.createElement('option')
        option.value = voice.name + '||' + voice.lang
        const label = voice.name + (voice.lang ? ` (${voice.lang})` : '')
        option.textContent = isIndonesianVoice(voice) ? '🇮🇩 ' + label : label
        if (isIndonesianVoice(voice)) option.dataset.indonesian = 'true'
        voiceSelect.appendChild(option)
    }
    
    if (voiceSelect.options.length === 0) { 
        voiceStatus.textContent = 'Tidak ada suara tersedia'; 
        voiceStatus.className = 'error'; 
        return 
    }
    
    const savedVoiceName = localStorage.getItem(VOICE_STORAGE_KEY)
    let selectedIndex = -1
    if (savedVoiceName) {
        for (let i = 0; i < voiceSelect.options.length; i++) { 
            if (voiceSelect.options[i].value.startsWith(savedVoiceName)) { selectedIndex = i; break } 
        }
    }
    if (selectedIndex === -1) {
        for (let i = 0; i < voiceSelect.options.length; i++) { 
            if (voiceSelect.options[i].dataset.indonesian === 'true') { selectedIndex = i; break } 
        }
    }
    if (selectedIndex === -1) selectedIndex = 0
    
    voiceSelect.selectedIndex = selectedIndex
    updateSelectedVoice(voiceSelect)
    voiceSelect.disabled = false
    
    const idCount = sorted.filter(v => isIndonesianVoice(v)).length
    voiceStatus.textContent = idCount > 0 ? idCount + ' suara Indonesia tersedia' : 'Suara Indonesia tidak tersedia'
    voiceStatus.className = idCount > 0 ? 'loaded' : 'error'
    state.voicesReady = true
}

export function loadVoices(voiceSelect, voiceStatus) {
    const voices = synth.getVoices()
    if (voices && voices.length > 0) { 
        populateVoiceSelector(voices, voiceSelect, voiceStatus)
        return true 
    }
    return false
}

export function initAudioControls(voiceSelect, voiceStatus, rateSlider, rateLabel, speakBtn) {
    voiceSelect.addEventListener('change', () => updateSelectedVoice(voiceSelect))

    if (synth) {
        synth.addEventListener('voiceschanged', () => { loadVoices(voiceSelect, voiceStatus) })
        if (!loadVoices(voiceSelect, voiceStatus)) { 
            const r = setInterval(() => { if (loadVoices(voiceSelect, voiceStatus)) clearInterval(r) }, 200)
            setTimeout(() => clearInterval(r), 5000) 
        }
    } else {
        voiceStatus.textContent = 'Browser tidak mendukung Speech Synthesis'; 
        voiceStatus.className = 'error'; 
        speakBtn.disabled = true
    }

    rateSlider.addEventListener('input', () => {
        const val = Math.round(parseFloat(rateSlider.value) * 10) / 10
        rateLabel.textContent = val.toFixed(1) + 'x'
        localStorage.setItem(RATE_STORAGE_KEY, val.toFixed(1))
    })
    
    const savedRate = localStorage.getItem(RATE_STORAGE_KEY)
    if (savedRate) { 
        rateSlider.value = savedRate; 
        rateLabel.textContent = parseFloat(savedRate).toFixed(1) + 'x' 
    }
}
