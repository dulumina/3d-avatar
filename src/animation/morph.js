import { state } from '../state.js'
import { LERP, EXPRESSION_MORPHS, MOOD_EXPRESSION } from '../constants.js'

export const morphState = {}
export let morphMap = {}
let morphLerpFrame = null
let lastFrameTime = 0

export function ensureMorphState(name) {
    if (!morphState[name]) morphState[name] = { current: 0, target: 0, velocity: 0 }
}

export function setMorphTarget(name, val) {
    ensureMorphState(name)
    morphState[name].target = Math.max(0, Math.min(1, val))
}

export function setMorph(name, val) {
    ensureMorphState(name)
    morphState[name].current = val
    morphState[name].target = val
    morphState[name].velocity = 0
    applyMorphRaw(name, val)
}

export function setExpressionTarget(name, val) {
    if (!name || !morphMap[name]) return
    setMorphTarget(name, val)
}

export function resetExpression(name) {
    if (!name || !morphMap[name]) return
    setMorphTarget(name, 0)
}

export function setMoodExpression(mood) {
    const expr = MOOD_EXPRESSION[mood]
    if (!expr) return
    for (const [name, val] of Object.entries(expr)) {
        if (morphMap[name]) setMorphTarget(name, val)
    }
}

export function clearMoodExpression() {
    for (const [name] of Object.entries(MOOD_EXPRESSION.neutral || {})) {
        if (morphMap[name]) setMorphTarget(name, 0)
    }
}

export function buildMorphMap(root) {
    const map = {}
    if (!root || typeof root.traverse !== 'function') return map
    root.traverse((obj) => {
        const dict = obj.morphTargetDictionary
        const infl = obj.morphTargetInfluences
        if (dict && infl) {
            for (const name of Object.keys(dict)) {
                const idx = dict[name]
                if (!map[name]) map[name] = []
                map[name].push({ mesh: obj, index: idx })
            }
        }
    })
    return map
}

export function setMorphMap(map) {
    morphMap = map
}

export function collectExpressionMorphs() {
    const all = []
    for (const group of Object.values(EXPRESSION_MORPHS)) {
        for (const name of group) {
            if (morphMap[name]) all.push(name)
        }
    }
    return all
}

export function findAvatarRoot() {
    if (!state.head) return null
    const head = state.head
    const direct = [head.avatar, head.armature, head.scene, head.root, head.model, head.body, head.gltf && head.gltf.scene]
    for (const c of direct) {
        if (c && typeof c.traverse === 'function') return c
    }
    const seen = new Set()
    const candidates = []
    for (const key of Object.keys(head)) {
        try {
            const val = head[key]
            if (val && typeof val === 'object' && typeof val.traverse === 'function' && !seen.has(val)) {
                seen.add(val); candidates.push(val)
            } else if (val && typeof val === 'object') {
                for (const key2 of Object.keys(val)) {
                    const val2 = val[key2]
                    if (val2 && typeof val2 === 'object' && typeof val2.traverse === 'function' && !seen.has(val2)) {
                        seen.add(val2); candidates.push(val2)
                    }
                }
            }
        } catch (e) { /* ignore getter errors */ }
    }
    for (const c of candidates) {
        let found = false
        c.traverse((obj) => { if (obj.morphTargetDictionary) found = true })
        if (found) return c
    }
    return candidates[0] || null
}

export function applyMorphRaw(name, val) {
    if (!name) return
    const clamped = Math.max(0, Math.min(1, val))
    const entries = morphMap[name]
    if (entries && entries.length > 0) {
        for (const { mesh, index } of entries) {
            mesh.morphTargetInfluences[index] = clamped
        }
        return
    }
    if (state.head && typeof state.head.setFixedValue === 'function' && state.head.mtAvatar && state.head.mtAvatar[name]) {
        state.head.setFixedValue(name, clamped)
    }
}

export function releaseMorph(name) {
    if (!name) return
    const entries = morphMap[name]
    if (entries && entries.length > 0) {
        for (const { mesh, index } of entries) {
            mesh.morphTargetInfluences[index] = 0
        }
        return
    }
    if (state.head && typeof state.head.setFixedValue === 'function' && state.head.mtAvatar && state.head.mtAvatar[name]) {
        state.head.setFixedValue(name, null)
    }
}

export function setJawOpen(val) {
    setMorphTarget(state.jawMorphName, Math.max(0, Math.min(1, val)))
}

export function tickMorphLerp(timestamp) {
    morphLerpFrame = requestAnimationFrame(tickMorphLerp)
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05)
    lastFrameTime = timestamp

    for (const [name, s] of Object.entries(morphState)) {
        if (Math.abs(s.current - s.target) < 0.0005) {
            if (s.current !== s.target) {
                s.current = s.target
                applyMorphRaw(name, s.target)
            }
            continue
        }
        const isJaw = name === state.jawMorphName
        const isBlink = /blink/i.test(name)
        let speed
        if (isJaw) {
            speed = s.target > s.current ? LERP.jawOpen : LERP.jawClose
        } else if (isBlink) {
            speed = LERP.blink
        } else {
            const isExpression = state.expressionMorphNames.includes(name)
            speed = isExpression ? LERP.expression : (s.target < s.current ? LERP.visemeFade : LERP.viseme)
        }
        s.current += (s.target - s.current) * Math.min(1, speed * dt)
        if (isJaw && s.target < 0.01 && s.current < 0.02) {
            s.current = 0
        }
        applyMorphRaw(name, s.current)
    }
}

export function startMorphLerp() {
    if (!morphLerpFrame) {
        lastFrameTime = performance.now()
        tickMorphLerp(lastFrameTime)
    }
}
