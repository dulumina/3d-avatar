export const GEMINI_KEY = 'GEMINI_KEY_REMOVED'
export const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash']

export const GESTURES = ['handup', 'index', 'ok', 'thumbup', 'thumbdown', 'side', 'shrug']

export const VOWEL_VISEME_MAP = {
    a: { morph: 'viseme_aa', jaw: 0.72 },
    i: { morph: 'viseme_I', jaw: 0.38 },
    u: { morph: 'viseme_U', jaw: 0.42 },
    e: { morph: 'viseme_E', jaw: 0.52 },
    o: { morph: 'viseme_O', jaw: 0.62 }
}

export const CONSONANT_JAW = {
    m: 0.05, b: 0.05, p: 0.05,
    n: 0.12, d: 0.12, t: 0.12,
    r: 0.18, l: 0.18,
    k: 0.15, g: 0.15,
    s: 0.10, z: 0.10,
    h: 0.20, f: 0.10, v: 0.10,
}

export const LERP = {
    jawOpen: 14,
    jawClose: 10,
    viseme: 12,
    visemeFade: 10,
    idle: 6,
}
