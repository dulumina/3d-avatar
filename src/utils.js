export function cleanWord(w) { 
    return w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() 
}

export function syllabify(word) {
    if (!word || word.length === 0) return []
    const vowels = 'aiueoAIUEO'
    const syls = []
    let cur = ''
    let i = 0
    while (i < word.length) {
        const ch = word[i]
        cur += ch
        if (vowels.includes(ch)) {
            syls.push(cur); cur = ''
        }
        i++
    }
    if (cur) {
        if (syls.length > 0) syls[syls.length - 1] += cur
        else syls.push(cur)
    }
    return syls.filter(s => s.length > 0)
}

let noiseT = 0
export function microNoise(amplitude) {
    noiseT += 0.07
    return amplitude * (Math.sin(noiseT * 3.7) * 0.5 + Math.sin(noiseT * 1.3) * 0.3 + Math.sin(noiseT * 7.1) * 0.2)
}

export function resetNoiseT() {
    noiseT = Math.random() * 100
}

export function autoResizeTextarea(textInput) {
    textInput.style.height = 'auto'
    textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px'
}
