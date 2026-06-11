import { state } from '../state.js'
import { BLINK_INTERVAL, BLINK_DURATION } from '../constants.js'
import { microNoise, resetNoiseT } from '../utils.js'
import { setJawOpen, setMorphTarget, ensureMorphState, releaseMorph, startMorphLerp, morphState, morphMap } from './morph.js'

let idleAnimFrame = null
let idlePhase = 0
let idleBrowPhase = 0
let idleEyePhase = 0
let idleMouthPhase = 0
let nextBlinkTime = 0

function scheduleNextBlink() {
    nextBlinkTime = Date.now() + BLINK_INTERVAL.min + Math.random() * (BLINK_INTERVAL.max - BLINK_INTERVAL.min)
}

function doBlink() {
    if (!state.expressionMorphNames.includes('eyeBlinkLeft') || !state.expressionMorphNames.includes('eyeBlinkRight')) return
    const blinkStrength = 0.95
    setMorphTarget('eyeBlinkLeft', blinkStrength)
    setMorphTarget('eyeBlinkRight', blinkStrength)
    state.isBlinking = true
    setTimeout(() => {
        setMorphTarget('eyeBlinkLeft', 0)
        setMorphTarget('eyeBlinkRight', 0)
        state.isBlinking = false
        scheduleNextBlink()
    }, BLINK_DURATION)
}

export function tickIdle(timestamp) {
    if (state.isSpeaking || !state.avatarReady) {
        idleAnimFrame = null; return
    }
    idleAnimFrame = requestAnimationFrame(tickIdle)

    const dt = 0.016
    idlePhase += 0.0008
    idleBrowPhase += 0.0012
    idleEyePhase += 0.0006
    idleMouthPhase += 0.0015

    if (state.jawMorphName) {
        const breathVal = 0.022 * (0.5 + 0.5 * Math.sin(idlePhase * Math.PI * 2))
        setMorphTarget(state.jawMorphName, breathVal)
    }

    if (Date.now() >= nextBlinkTime && !state.isBlinking) {
        doBlink()
    }

    const browNames = ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight']
    for (const name of browNames) {
        if (state.expressionMorphNames.includes(name)) {
            const idx = browNames.indexOf(name)
            const val = 0.06 * (0.5 + 0.5 * Math.sin(idleBrowPhase * Math.PI * 2 + idx * 1.5))
            setMorphTarget(name, val)
        }
    }

    const eyeLookNames = ['eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight',
                          'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight']
    for (const name of eyeLookNames) {
        if (state.expressionMorphNames.includes(name)) {
            const idx = eyeLookNames.indexOf(name)
            const val = 0.08 * (0.5 + 0.5 * Math.sin(idleEyePhase * Math.PI * 2 + idx * 0.9))
            setMorphTarget(name, val)
        }
    }

    const mouthIdleNames = ['mouthRollLower', 'mouthRollUpper', 'mouthStretchLeft', 'mouthStretchRight',
                            'mouthPressLeft', 'mouthPressRight', 'mouthPucker']
    for (const name of mouthIdleNames) {
        if (state.expressionMorphNames.includes(name)) {
            const idx = mouthIdleNames.indexOf(name)
            const slow = idx < 2 ? 0.3 : 1.0
            const val = 0.04 * (0.5 + 0.5 * Math.sin(idleMouthPhase * Math.PI * 2 * slow + idx * 1.2))
            setMorphTarget(name, val)
        }
    }
}

export function startIdleAnimation() {
    if (!idleAnimFrame) {
        scheduleNextBlink()
        requestAnimationFrame(tickIdle)
    }
}

export function stopIdleAnimation() {
    if (idleAnimFrame) { cancelAnimationFrame(idleAnimFrame); idleAnimFrame = null }
}

export function animateMouthElapsed() {
    if (!state.mouthActive) { stopMouthAnimation(); return }
    if (state.mouthTimeline.length === 0) { state.mouthActive = false; stopMouthAnimation(); return }

    const elapsed = Date.now() - state.speechStartTime

    if (Date.now() >= nextBlinkTime && !state.isBlinking) {
        doBlink()
    }

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
        setJawOpen(0)
        if (state.lastVisemeName) { setMorphTarget(state.lastVisemeName, 0); state.lastVisemeName = null }
        state.mouthAnimFrame = requestAnimationFrame(animateMouthElapsed)
        return
    }

    const current = state.mouthTimeline[curIdx]

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

    if (current.viseme && morphMap[current.viseme]) {
        const newVn = current.viseme
        if (state.lastVisemeName && state.lastVisemeName !== newVn) {
            setMorphTarget(state.lastVisemeName, 0)
        }
        const visemeIntensity = Math.max(0, current.jawOpen * 1.1 - 0.05)
        setMorphTarget(newVn, Math.min(1, visemeIntensity))
        state.lastVisemeName = newVn
    } else if (current.jawOpen < 0.08) {
        if (state.lastVisemeName) { setMorphTarget(state.lastVisemeName, 0); state.lastVisemeName = null }
    }

    if (current.jawOpen > 0.3) {
        const emphasis = Math.min(1, (current.jawOpen - 0.3) / 0.5) * 0.2
        if (state.expressionMorphNames.includes('browInnerUp')) {
            setMorphTarget('browInnerUp', emphasis)
        }
        if (state.expressionMorphNames.includes('browOuterUpLeft')) {
            setMorphTarget('browOuterUpLeft', emphasis * 0.7)
        }
        if (state.expressionMorphNames.includes('browOuterUpRight')) {
            setMorphTarget('browOuterUpRight', emphasis * 0.7)
        }
    }

    state.mouthAnimFrame = requestAnimationFrame(animateMouthElapsed)
}

export function startMouthAnimation() {
    if (state.mouthAnimFrame) cancelAnimationFrame(state.mouthAnimFrame)
    stopIdleAnimation()
    state.mouthActive = true
    resetNoiseT()
    scheduleNextBlink()
    if (state.mouthTimeline.length > 0) {
        state.lastGestureIdx = -1; state.lastVisemeName = null
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
    setTimeout(() => { if (!state.isSpeaking) startIdleAnimation() }, 800)
}
