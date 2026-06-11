export const GEMINI_KEY = 'GEMINI_KEY_REMOVED'
export const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash']

export const GESTURES = ['handup', 'index', 'ok', 'thumbup', 'thumbdown', 'side', 'shrug', 'namaste']

export const VOWEL_VISEME_MAP = {
    a: { morph: 'viseme_aa', jaw: 0.72 },
    i: { morph: 'viseme_I', jaw: 0.38 },
    u: { morph: 'viseme_U', jaw: 0.42 },
    e: { morph: 'viseme_E', jaw: 0.52 },
    o: { morph: 'viseme_O', jaw: 0.62 }
}

export const CONSONANT_VISEME_MAP = {
    p: 'viseme_PP', b: 'viseme_PP', m: 'viseme_PP',
    f: 'viseme_FF', v: 'viseme_FF',
    t: 'viseme_DD', d: 'viseme_DD',
    k: 'viseme_kk', g: 'viseme_kk',
    s: 'viseme_SS', z: 'viseme_SS',
    n: 'viseme_nn', l: 'viseme_nn',
    r: 'viseme_RR',
    h: 'viseme_I',
    c: 'viseme_SS', j: 'viseme_SS',
    q: 'viseme_kk', x: 'viseme_kk',
    w: 'viseme_U',
    y: 'viseme_I',
    ng: 'viseme_nn', ny: 'viseme_nn',
    sy: 'viseme_SS', kh: 'viseme_kk',
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
    jawClose: 40,
    viseme: 12,
    visemeFade: 10,
    idle: 6,
    expression: 8,
    blink: 20,
}

export const EXPRESSION_MORPHS = {
    brows: ['browInnerUp', 'browDownLeft', 'browDownRight', 'browOuterUpLeft', 'browOuterUpRight'],
    eyes: ['eyeBlinkLeft', 'eyeBlinkRight', 'eyeWideLeft', 'eyeWideRight', 'eyeSquintLeft', 'eyeSquintRight',
           'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight',
           'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight'],
    mouth: ['mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
            'mouthPucker', 'mouthFunnel', 'mouthRollLower', 'mouthRollUpper',
            'mouthStretchLeft', 'mouthStretchRight', 'mouthPressLeft', 'mouthPressRight',
            'mouthShrugLower', 'mouthShrugUpper', 'mouthDimpleLeft', 'mouthDimpleRight',
            'mouthLeft', 'mouthRight', 'mouthClose', 'mouthLowerDownLeft', 'mouthLowerDownRight',
            'mouthUpperUpLeft', 'mouthUpperUpRight'],
    nose: ['noseSneerLeft', 'noseSneerRight'],
    cheek: ['cheekPuff', 'cheekSquintLeft', 'cheekSquintRight'],
}

export const MOOD_EXPRESSION = {
    neutral: {},
    happy: {
        browInnerUp: 0.3,
        mouthSmileLeft: 0.5,
        mouthSmileRight: 0.5,
        cheekSquintLeft: 0.15,
        cheekSquintRight: 0.15,
    },
    excited: {
        browInnerUp: 0.6,
        eyeWideLeft: 0.4,
        eyeWideRight: 0.4,
        mouthSmileLeft: 0.6,
        mouthSmileRight: 0.6,
        cheekSquintLeft: 0.2,
        cheekSquintRight: 0.2,
    },
    sad: {
        browInnerUp: 0.5,
        browDownLeft: 0.15,
        browDownRight: 0.15,
        eyeSquintLeft: 0.3,
        eyeSquintRight: 0.3,
        mouthFrownLeft: 0.5,
        mouthFrownRight: 0.5,
        mouthRollLower: 0.2,
    },
    angry: {
        browDownLeft: 0.7,
        browDownRight: 0.7,
        eyeSquintLeft: 0.5,
        eyeSquintRight: 0.5,
        mouthFrownLeft: 0.6,
        mouthFrownRight: 0.6,
        mouthPressLeft: 0.3,
        mouthPressRight: 0.3,
        noseSneerLeft: 0.3,
        noseSneerRight: 0.3,
    },
}

export const BLINK_INTERVAL = { min: 2000, max: 6000 }
export const BLINK_DURATION = 80
