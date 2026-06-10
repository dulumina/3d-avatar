import { state } from '../state.js'
import { microNoise, resetNoiseT } from '../utils.js'
import { setJawOpen, setMorphTarget, ensureMorphState, releaseMorph, startMorphLerp, morphState } from './morph.js'

let idleAnimFrame = null
let idlePhase = 0

export function tickIdle(timestamp) {
    if (state.isSpeaking || !state.avatarReady || !state.jawMorphName) {
        idleAnimFrame = null; return
    }
    idleAnimFrame = requestAnimationFrame(tickIdle)
    idlePhase += 0.0008  // very slow
    // Very tiny jaw movement — like breathing, almost imperceptible
    const breathVal = 0.022 * (0.5 + 0.5 * Math.sin(idlePhase * Math.PI * 2))
    setMorphTarget(state.jawMorphName, breathVal)
}

export function startIdleAnimation() {
    if (!idleAnimFrame) requestAnimationFrame(tickIdle)
}

export function stopIdleAnimation() {
    if (idleAnimFrame) { cancelAnimationFrame(idleAnimFrame); idleAnimFrame = null }
}

export function animateMouthElapsed() {
    if (!state.mouthActive) { stopMouthAnimation(); return }
    if (state.mouthTimeline.length === 0) { state.mouthActive = false; stopMouthAnimation(); return }

    const elapsed = Date.now() - state.speechStartTime

    // Find current segment via binary search for performance
    let curIdx = -1
    let lo = 0, hi = state.mouthTimeline.length - 1
    while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const e = state.mouthTimeline[mid]
        if (elapsed >= e.time && elapsed < e.endTime) { curIdx = mid; break }
        else if (elapsed < e.time) hi = mid - 1
        else lo = mid + 1
    }

    if (curIdx === -1) {
        if (state.mouthTimeline.length > 0 && elapsed > state.mouthTimeline[state.mouthTimeline.length - 1].endTime + 300) {
            stopMouthAnimation()
            if (state.head && state.head.stopGesture) state.head.stopGesture(500)
            return
        }
        // Gap between segments — let lerp gently close mouth
        setJawOpen(0)
        if (state.lastVisemeName) { setMorphTarget(state.lastVisemeName, 0); state.lastVisemeName = null }
        state.mouthAnimFrame = requestAnimationFrame(animateMouthElapsed)
        return
    }

    const current = state.mouthTimeline[curIdx]

    // Gesture trigger (once per segment)
    if (current.gesture && curIdx !== state.lastGestureIdx) {
        state.lastGestureIdx = curIdx
        if (state.head && state.head.playGesture) {
            try { state.head.playGesture(current.gesture.gesture, Math.min(current.gesture.duration || 0.8, 0.8)) }
            catch (e) { console.warn('playGesture failed:', e) }
        }
    }

    const segDur = current.endTime - current.time
    const segProgress = (elapsed - current.time) / segDur

    const jawCurrent = current.jawOpen
    const jawNext = curIdx + 1 < state.mouthTimeline.length ? state.mouthTimeline[curIdx + 1].jawOpen : 0
    const jawPrev = curIdx > 0 ? state.mouthTimeline[curIdx - 1].jawOpen : 0

    let jawTarget
    if (segProgress < 0.5) {
        const t = segProgress / 0.5
        const smooth = t * t * (3 - 2 * t) 
        jawTarget = jawPrev + (jawCurrent - jawPrev) * smooth
    } else {
        const t = (segProgress - 0.5) / 0.5
        const smooth = t * t * (3 - 2 * t)
        jawTarget = jawCurrent + (jawNext - jawCurrent) * smooth
    }

    const noise = jawCurrent > 0.15 ? microNoise(0.012) : 0
    setJawOpen(Math.max(0, jawTarget + noise))

    if (current.vowel && state.visemeMorphNames[current.vowel]) {
        const newVn = state.visemeMorphNames[current.vowel]
        if (state.lastVisemeName && state.lastVisemeName !== newVn) {
            setMorphTarget(state.lastVisemeName, 0)
        }
        const visemeIntensity = Math.max(0, current.jawOpen * 1.1 - 0.05)
        setMorphTarget(newVn, Math.min(1, visemeIntensity))
        state.lastVisemeName = newVn
    } else if (current.jawOpen < 0.08) {
        if (state.lastVisemeName) { setMorphTarget(state.lastVisemeName, 0); state.lastVisemeName = null }
    }

    state.mouthAnimFrame = requestAnimationFrame(animateMouthElapsed)
}

export function startMouthAnimation() {
    if (state.mouthAnimFrame) cancelAnimationFrame(state.mouthAnimFrame)
    stopIdleAnimation()
    state.mouthActive = true
    resetNoiseT()
    if (state.mouthTimeline.length > 0) {
        state.lastGestureIdx = -1; state.lastVisemeName = null
        console.log('MOUTH start, segments:', state.mouthTimeline.length)
    }
    startMorphLerp()
    animateMouthElapsed()
}

export function stopMouthAnimation() {
    state.mouthActive = false
    if (state.mouthAnimFrame) { cancelAnimationFrame(state.mouthAnimFrame); state.mouthAnimFrame = null }
    if (state.lastVisemeName) { 
        releaseMorph(state.lastVisemeName); 
        ensureMorphState(state.lastVisemeName); 
        morphState[state.lastVisemeName].current = 0; 
        morphState[state.lastVisemeName].target = 0; 
        state.lastVisemeName = null 
    }
    if (state.jawMorphName) { 
        releaseMorph(state.jawMorphName); 
        ensureMorphState(state.jawMorphName); 
        morphState[state.jawMorphName].current = 0; 
        morphState[state.jawMorphName].target = 0 
    }
    state.mouthTimeline = []
    console.log('MOUTH end, elapsed:', Date.now() - state.speechStartTime, 'ms')
    setTimeout(() => { if (!state.isSpeaking) startIdleAnimation() }, 800)
}
