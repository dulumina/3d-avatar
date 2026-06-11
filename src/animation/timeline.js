import { state } from '../state.js'
import { VOWEL_VISEME_MAP, CONSONANT_VISEME_MAP, CONSONANT_JAW } from '../constants.js'
import { cleanWord, syllabify } from '../utils.js'

export function buildMouthTimeline(words, rate) {
    const tl = []
    let cum = 0

    const BASE_SYL_DUR = 120 / rate    
    const BASE_CODA_DUR = 40 / rate    
    const WORD_PAUSE = 90 / rate    

    for (let w = 0; w < words.length; w++) {
        const clean = cleanWord(words[w])
        if (!clean) { cum += WORD_PAUSE; continue }

        const syls = syllabify(clean)
        const gesture = state.gestureSchedule.find(g => cleanWord(g.word) === clean) || null

        for (let s = 0; s < syls.length; s++) {
            const syl = syls[s]

            const vowelMatch = syl.match(/[aiueoAIUEO]/)
            const vowel = vowelMatch ? vowelMatch[0].toLowerCase() : null
            const cfg = vowel ? VOWEL_VISEME_MAP[vowel] : null

            let onset = '', nucleus = '', coda = ''
            if (vowelMatch) {
                const vIdx = syl.indexOf(vowelMatch[0])
                onset = syl.slice(0, vIdx)
                nucleus = vowelMatch[0]
                coda = syl.slice(vIdx + 1)
            } else {
                coda = syl  
            }

            const onsetDur = onset.length > 0 ? Math.max(20, onset.length * 22 / rate) : 0
            const nucleusDur = nucleus ? Math.max(55, BASE_SYL_DUR * (vowel === 'a' || vowel === 'o' ? 1.15 : 0.9)) : 0
            const codaDur = coda.length > 0 ? Math.max(18, coda.length * 20 / rate) : BASE_CODA_DUR

            if (onsetDur > 0) {
                const firstCons = onset[onset.length - 1]?.toLowerCase()
                const consJaw = CONSONANT_JAW[firstCons] || 0.08
                const consViseme = CONSONANT_VISEME_MAP[firstCons] || null
                tl.push({
                    time: cum,
                    endTime: cum + onsetDur,
                    jawOpen: consJaw,
                    vowel: null,
                    viseme: consViseme,
                    gesture: s === 0 ? gesture : null,
                })
                cum += onsetDur
            }

            if (nucleusDur > 0 && cfg) {
                tl.push({
                    time: cum,
                    endTime: cum + nucleusDur,
                    jawOpen: cfg.jaw,
                    vowel: vowel,
                    viseme: cfg.morph,
                    gesture: onsetDur === 0 && s === 0 ? gesture : null,
                })
                cum += nucleusDur
            }

            if (codaDur > 0) {
                const lastCons = coda[0]?.toLowerCase()
                const consJaw = CONSONANT_JAW[lastCons] || 0.06
                const consViseme = CONSONANT_VISEME_MAP[lastCons] || null
                tl.push({
                    time: cum,
                    endTime: cum + codaDur,
                    jawOpen: nucleus ? consJaw : 0,
                    vowel: null,
                    viseme: consViseme,
                    gesture: null,
                })
                cum += codaDur
            }
        }

        tl.push({ time: cum, endTime: cum + WORD_PAUSE, jawOpen: 0, vowel: null, viseme: null, gesture: null })
        cum += WORD_PAUSE
    }
    return tl
}
