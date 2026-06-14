import { GEMINI_KEY, GEMINI_MODELS } from './constants.js'
import { cleanWord } from './utils.js'
import { sentimentToMood } from './sentiment.js'
import { StemmerId } from '@nlpjs/lang-id'

const GESTURE_CACHE = new Map()
const stemmer = new StemmerId()

const KEYWORD_MAP = [
    { g: 'handup', words: [
        'halo', 'hai', 'hi', 'hey', 'selamat', 'assalamualaikum', 'selamatpagi', 'selamatsiang', 'selamatmalam', 'selamatdatang',
        'ayolah', 'marilah', 'ayok', 'ayo', 'mari', 'yuk', 'majulah', 'silakan', 'silahkan', 'biarkan', 'izinkan',
        'penting', 'utama', 'besar', 'nomorsatu', 'prioritas', 'krusial', 'vital', 'sangatpenting', 'terpenting', 'pokok',
        'program', 'acara', 'agenda', 'inisiatif', 'gerakan',
        'seru', 'wow', 'dahsyat', 'amazing', 'fantastis', 'sungguh', 'luarbiasa', 'dasyat',
        'hebat', 'mantap', 'keren', 'bagus', 'luarbiasa', 'dahsyat', 'top',
        'perhatian', 'hatihati', 'waspada', 'awas', 'lihat',
        'datang', 'hadir', 'mari', 'kesini', 'kemari',
        'sekali', 'sangat', 'paling', 'terlalu', 'teramat',
        'berkumpul', 'kumpul', 'rapat', 'pertemuan', 'bersama',
        'merdeka', 'bebas', 'hidup', 'jayalah',
    ]},
    { g: 'index', words: [
        'saya', 'aku', 'kami', 'kita', 'kitah', 'gue', 'gw', 'akuh', 'diriku',
        'kelompok', 'tim', 'regu',
        'ini', 'itu', 'tersebut', 'berikut', 'berikutnya', 'inilah', 'itulah',
        'pertama', 'kedua', 'ketiga', 'keempat', 'kelima', 'keenam', 'ketujuh', 'kedelapan', 'kesembilan', 'kesepuluh',
        'terakhir', 'selanjutnya', 'tambahan', 'pertamatama', 'pertama-tama',
        'disini', 'disitu', 'disana', 'dísana', 'kesini', 'kesitu', 'kesana',
        'diatas', 'dibawah', 'disamping', 'disebelah',
        'sini', 'situ', 'sana',
        'contoh', 'misal', 'misalnya', 'seperti', 'contohnya',
        'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh',
        'pertama', 'kedua', 'ketiga',
        'pertahapan', 'tahap', 'langkah', 'bagian',
    ]},
    { g: 'ok', words: [
        'iya', 'ya', 'oke', 'ok', 'baik', 'baiklah', 'setuju', 'benar', 'benar sekali', 'benarbenar',
        'tentu', 'tentulah', 'tentunya', 'sependapat', 'betul', 'sepakat', 'sip', 'deal', 'okelah',
        'pastilah', 'tentu', 'pasti', 'yakin', 'percaya', 'mempercayai',
        'boleh', 'silakan', 'silahkan', 'biarkan', 'izinkan', 'perbolehkan', 'diperbolehkan',
        'diterima', 'disetujui', 'sah', 'resmi',
        'memang', 'sudah', 'telah', 'benarbenar', 'sesungguhnya',
        'terimakasih', 'makasih',
    ]},
    { g: 'namaste', words: [
        'terimakasih', 'makasih', 'trims', 'thanks', 'terimakasihbanyak', 'terimakasihkembali', 'samamata',
        'hormat', 'salam', 'sembah', 'sujud', 'takzim', 'respek',
        'doa', 'syukur', 'alhamdulillah', 'berdoa', 'mendoakan', 'doakan',
        'berkah', 'rahmat', 'karunia',
        'maaf', 'maafkan', 'mohonmaaf', 'ampun',
        'selamatpagi', 'selamatsiang', 'selamatmalam', 'selamatdatang', 'selamathari',
        'shalom', 'wassalam', 'wassalamualaikum',
    ]},
    { g: 'thumbup', words: [
        'sukses', 'juara', 'puji', 'syukur', 'bangga', 'senang', 'terbaik', 'excellent',
        'luarbiasa', 'prestasi', 'berhasil', 'menang', 'kejuaraan', 'pemenang',
        'bagus', 'hebat', 'mantap', 'keren', 'indah', 'cantik', 'baik', 'suka', 'sangatbaik',
        'elok', 'menarik', 'memukau', 'mengesankan',
        'berkualitas', 'bermutu', 'memuaskan', 'sempurna', 'unggul', 'prima', 'bernilai',
        'bahagia', 'gembira', 'ceria', 'puas', 'lega', 'riang', 'giat',
        'peduli', 'bantu', 'membantu', 'menjaga', 'merawat', 'melestarikan',
        'bermanfaat', 'berguna', 'berfaedah', 'mulia', 'terpuji',
        'inovatif', 'kreatif', 'produktif', 'maju', 'modern', 'mutakhir',
        'lancar', 'beres', 'rapi', 'tertib', 'teratur',
        'bersih', 'sehat', 'bugar', 'kuat', 'tangguh', 'hijau', 'asri', 'rindang', 'lestari',
        'aman', 'nyaman', 'damai', 'tentram', 'rukun',
        'cerdas', 'pintar', 'pandai', 'cermat', 'teliti', 'bijak',
        'adil', 'makmur', 'sejahtera', 'sentosa',
        'tumbuh', 'berkembang', 'meningkat', 'naik', 'membaik', 'kualitas',
        'tepat', 'benar', 'akurat', 'sahih',
        'mudah', 'cepat', 'efisien', 'ringkas',
        'setuju', 'sepakat', 'sependapat',
        'layak', 'pantas',
        'antusias', 'semangat', 'rajin', 'aktif', 'berpartisipasi', 'partisipasi', 'turut',
        'tulus', 'ikhlas', 'sabar', 'syukur', 'terima',
    ]},
    { g: 'thumbdown', words: [
        'jelek', 'buruk', 'parah', 'payah', 'bodoh', 'tolol', 'bego', 'sinting', 'edan',
        'gagal', 'rugi', 'salah', 'keliru', 'salahbesar', 'kekeliruan',
        'malas', 'pemalas', 'lalai', 'culun', 'norak',
        'sedih', 'duka', 'prihatin', 'kecewa', 'mengecewakan',
        'marah', 'benci', 'kesal', 'sebal', 'jengkel', 'geram', 'murka',
        'takut', 'cemas', 'gelisah', 'khawatir', 'waswas',
        'bingung', 'risau', 'resah', 'galau',
        'susah', 'sulit', 'sukar', 'rumit', 'pelik', 'kompleks',
        'berat', 'lemah', 'rapuh', 'lembek',
        'sakit', 'luka', 'cedera', 'derita',
        'kotor', 'kumuh', 'jorok', 'mesum',
        'macet', 'hambat', 'terlambat', 'telat',
        'rusak', 'hancur', 'musnah', 'hilang', 'lenyap',
        'krisis', 'ancam', 'ancaman', 'darurat', 'kritis',
        'korupsi', 'kolusi', 'nepotisme',
        'miskin', 'fakir', 'kemiskinan',
        'nganggur', 'pengangguran',
        'kecelakaan', 'tabrakan', 'tumburan',
        'kerusuhan', 'konflik', 'perang', 'pertikaian',
        'kekerasan', 'kriminal', 'kejahatan', 'jahat', 'kriminalitas',
        'pelanggaran', 'korban', 'kebakaran',
        'banjir', 'longsor', 'tsunami', 'gempa', 'bencana', 'musibah',
        'polusi', 'limbah', 'sampah',
        'menakutkan', 'mengerikan', 'mencekam', 'mengkhawatirkan',
        'kerugian', 'kemunduran', 'kehancuran',
        'sial', 'nasibsial',
        'pelit', 'kikir', 'serakah', 'rakus', 'tamak',
        'licik', 'curang', 'dusta', 'bohong', 'tipu', 'menipu',
        'kasar', 'brutal', 'biadab', 'kasar',
        'zalim', 'kejam', 'bengis', 'sadis',
        'cemburu', 'iri', 'dengki', 'sombong', 'angkuh',
        'malapetaka', 'petaka',
        'memburuk', 'menurun', 'merosot', 'meleset',
        'protes', 'demo', 'unjukrasa', 'mogok',
        'pahit', 'getir', 'perih',
    ]},
    { g: 'side', words: [
        'kamu', 'anda', 'kau', 'dikau', 'lu', 'elo', 'saudara', 'hadirin',
        'mereka', 'dia', 'ia', 'beliau', 'sekalian',
        'semua', 'seluruh', 'sekalian',
        'publik', 'warga', 'masyarakat', 'rakyat', 'hadirin', 'audiens', 'tamu',
        'khalayak', 'umum', 'orang', 'penduduk',
        'kelompok', 'komunitas', 'organisasi', 'lembaga', 'tim', 'regu',
        'parasiswa', 'pelajar', 'mahasiswa', 'pelajar',
        'pemimpin', 'kepala', 'pimpinan', 'presiden', 'gubernur', 'wali',
        'tetangga', 'teman', 'sahabat', 'kolega', 'rekan',
        'bapak', 'ibu', 'pak', 'bu', 'mas', 'mbak', 'kakak', 'adik',
        'guru', 'dosen', 'pengajar',
        'disana', 'disitu', 'dísana', 'disini',
        'sana', 'situ', 'sini',
        'kota', 'daerah', 'kabupaten', 'provinsi', 'negara', 'desa', 'kampung',
        'titik', 'lokasi', 'tempat', 'kawasan', 'wilayah', 'zona',
        'lingkung', 'alam', 'dunia',
    ]},
    { g: 'shrug', words: [
        'mungkin', 'barangkali', 'kalau', 'seandainya', 'andaikan', 'sekiranya',
        'kurangtahu', 'bingung', 'entah', 'terserah', 'entahlah', 'kurangpaham', 'terserah',
        'tidak', 'bukan', 'jangan', 'nggak', 'ga', 'gak', 'tak', 'tiada', 'tanpa',
        'bukanlah', 'tidaklah', 'belum', 'belumlagi',
        'tahulah', 'nggaktau', 'gaktau',
        'mungkin', 'mungkinsekali', 'sepertinya', 'rasanya',
        'bimbang', 'ragu', 'meragukan', 'tidakpasti',
        'diam', 'tenang', 'hening',
        'apalah', 'terserahlah',
        'mana', 'kemana', 'dari mana', 'dimana',
        'ah', 'yah', 'hmm',
        'kok', 'sih', 'deh', 'loh', 'dong',
    ]},
]

const ALL_KEYWORDS = new Set()
for (const r of KEYWORD_MAP) {
    for (const w of r.words) {
        ALL_KEYWORDS.add(w)
    }
}

function buildKeywordPrompt() {
    const groups = [
        { g: 'handup', label: 'melambai/mengangkat tangan (salam, seru, emphasis, ajakan)' },
        { g: 'index', label: 'menunjuk (saya/aku/ini/itu/pertama/kedua)' },
        { g: 'ok', label: 'tanda OK (setuju, ya, baik, pasti)' },
        { g: 'thumbup', label: 'jempol naik (bagus, hebat, sukses, positif)' },
        { g: 'thumbdown', label: 'jempol turun (jelek, gagal, buruk, negatif)' },
        { g: 'side', label: 'menunjuk samping (dia, mereka, masyarakat, sana)' },
        { g: 'shrug', label: 'angkat bahu (tidak tahu, mungkin, bingung, ?)' },
        { g: 'namaste', label: 'tangan bersedekap (hormat, terima kasih, salam)' },
    ]
    let s = ''
    for (const { g, label } of groups) {
        const rule = KEYWORD_MAP.find(r => r.g === g)
        if (rule) {
            s += `- ${g} = ${label} → contoh kata: ${rule.words.slice(0, 12).join(', ')}...\n`
        }
    }
    return s
}

export async function keywordFallback(text, words) {
    const gestures = []
    const lower = text.toLowerCase()
    const wordList = words || lower.split(/\s+/).filter(w => w.length > 0)
    if (wordList.length === 0) return { mood: 'neutral', gestures: [] }

    const mood = await sentimentToMood(text)
    const usedIndices = new Set()
    const total = wordList.length

    const NUMBER_WORDS = new Set(['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh',
        'seratus', 'duaratus', 'tigaratus', 'seribu', 'duaribu', 'sejuta', 'sejuta', 'ribuan', 'jutaan', 'puluhan', 'ratusan', 'belasan'])

    const STOP_WORDS = new Set(['dan', 'atau', 'yang', 'di', 'ke', 'dari', 'dgn', 'dengan', 'untuk', 'pada', 'ini', 'itu',
        'oleh', 'sebagai', 'secara', 'serta', 'agar', 'supaya', 'telah', 'sudah', 'sedang', 'akan', 'bisa', 'dapat',
        'juga', 'saja', 'tapi', 'namun', 'tetapi', 'sedangkan', 'sementara', 'sangat', 'paling', 'para', 'si', 'se',
        'dalam', 'antar', 'antara', 'setelah', 'sebelum', 'saat', 'ketika', 'sambil', 'tanpa', 'hingga', 'sampai',
        'adalah', 'ialah', 'yakni', 'yaitu', 'bahwa',
    ])

    const ADJ_ADV = new Set(['sangat', 'paling', 'lebih', 'kurang', 'cukup', 'agak', 'semakin', 'makin'])

    function isProperNoun(raw, idx) {
        if (idx === 0) return false
        return /^[A-Z]/.test(raw) && !/^[A-Z]/.test(wordList[0])
    }

    function hasDigit(w) {
        return /\d/.test(w)
    }

    function isNumberWord(w) {
        return NUMBER_WORDS.has(w) || /\d/.test(w)
    }

    function isStopWord(w) { return STOP_WORDS.has(w) }
    function isAdjOrAdv(w) { return ADJ_ADV.has(w) }

    const matchedWords = new Map()
    for (let i = 0; i < total; i++) {
        const raw = wordList[i]
        const cleaned = cleanWord(raw)
        if (!cleaned) continue
        const w = cleaned

        if (isStopWord(w) || isAdjOrAdv(w)) continue

        let gesture = null
        let stemmed = null

        try {
            stemmed = stemmer.stemWord(w)
        } catch (e) {
            stemmed = w
        }

        if (isNumberWord(w) || hasDigit(w)) {
            gesture = 'handup'
            if (!matchedWords.has(i)) matchedWords.set(i, { word: raw, gesture })
            continue
        }

        for (const rule of KEYWORD_MAP) {
            if (rule.words.includes(w) || (stemmed && stemmed !== w && rule.words.includes(stemmed))) {
                if (!matchedWords.has(i)) matchedWords.set(i, { word: raw, gesture: rule.g })
                break
            }
        }

        if (gesture && !matchedWords.has(i)) {
            matchedWords.set(i, { word: raw, gesture })
        }
    }

    const gapMin = 2
    const sortedEntries = [...matchedWords.entries()]
    const selected = []
    for (const [idx, data] of sortedEntries) {
        if (selected.length > 0 && idx - selected[selected.length - 1].idx <= gapMin) continue
        selected.push({ ...data, idx })
    }

    if (selected.length >= 2) {
        const shuffled = [...selected].sort(() => Math.random() - 0.5)
        const picked = shuffled.slice(0, Math.min(3, shuffled.length))
        for (const s of picked) {
            usedIndices.add(s.idx)
            const importance = s.idx === 0 || s.idx === total - 1 ? 1.3 : 1
            const dur = Math.min(2.5, Math.max(1.2, 1.2 + Math.random() * 0.8 * importance))
            gestures.push({ word: s.word, gesture: s.gesture, duration: Math.round(dur * 10) / 10 })
        }
    }

    if (gestures.length < 3 && total >= 6) {
        const sections = [
            { start: 0, end: Math.floor(total / 3) },
            { start: Math.floor(total / 3), end: Math.floor(2 * total / 3) },
            { start: Math.floor(2 * total / 3), end: total },
        ]
        for (const sec of sections) {
            if (gestures.length >= 3) break
            const candidates = []
            for (let i = sec.start; i < sec.end && i < total; i++) {
                if (usedIndices.has(i)) continue
                const raw = wordList[i]
                const w = cleanWord(raw)
                if (!w || isStopWord(w)) continue

                let gesture = null
                let priority = 0

                if (/\d/.test(w) || NUMBER_WORDS.has(w)) { gesture = 'handup'; priority = 3 }
                else if (isProperNoun(raw, i)) { gesture = 'index'; priority = 3 }
                else if (i === sec.start || i === sec.end - 1 || i === Math.floor((sec.start + sec.end) / 2)) {
                    const pick = ['handup', 'side', 'ok']
                    gesture = pick[Math.floor(Math.random() * pick.length)]
                    priority = 1
                }

                if (gesture && priority > 0) {
                    candidates.push({ idx: i, word: raw, gesture, priority })
                }
            }
            candidates.sort((a, b) => b.priority - a.priority)
            if (candidates.length > 0) {
                const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 2))]
                if (pick) {
                    usedIndices.add(pick.idx)
                    const dur = pick.priority >= 3
                        ? Math.round((1.8 + Math.random() * 0.7) * 10) / 10
                        : Math.round((1.2 + Math.random() * 0.6) * 10) / 10
                    gestures.push({ word: pick.word, gesture: pick.gesture, duration: dur })
                }
            }
        }
    }

    if (gestures.length === 0) {
        const mid = Math.floor(total / 3)
        if (mid < total && wordList[mid]) {
            const pick = ['handup', 'side', 'ok']
            gestures.push({ word: wordList[mid], gesture: pick[Math.floor(Math.random() * pick.length)], duration: 2 })
        }
    }

    return { mood, gestures }
}

export async function analyzeTextWithGemini(text, model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const prompt = `Kamu adalah sutradara gestur untuk avatar 3D presenter Bahasa Indonesia.

Analisis teks berita/presentasi berikut dan tentukan gestur tangan yang natural untuk kata-kata kunci SAJA (pilih 2-4 gestur tersebar merata).

Pilihan gestur dan contoh kata kuncinya:
${buildKeywordPrompt()}

Tentukan mood: neutral | happy | excited | sad | angry

Output JSON SAJA tanpa markdown, tanpa penjelasan:
{"mood":"neutral","gestures":[{"word":"Kata","gesture":"handup","duration":2},{"word":"Saya","gesture":"index","duration":1.5}]}

PENTING:
- Gunakan kata yang BENAR-BENAR ADA dalam teks sebagai value "word"
- Jangan beri gestur untuk kata sambung (dan, atau, yang, di, ke, dari, dll) atau kata sifat umum
- Beri jeda alami: jangan 2 gestur berurutan tanpa jeda minimal 2-3 kata di antaranya
- Untuk teks berita/formal: pilih kata kunci bermakna (program, masyarakat, lingkungan, kota, penghijauan, dll)
- Acak jenis gestur, jangan monoton

Teks: ${text}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
            }),
            signal: controller.signal
        })
        clearTimeout(timeout)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
        const data = await resp.json()
        const parts = data?.candidates?.[0]?.content?.parts
        const raw = Array.isArray(parts) ? parts.map(p => p.text).filter(Boolean).join('') : null
        if (!raw) throw new Error('Gemini: empty response')
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        return JSON.parse(cleaned)
    } catch (e) {
        clearTimeout(timeout)
        if (e.name === 'AbortError') throw new Error('Timeout')
        throw e
    }
}

export async function getGestureSchedule(text) {
    if (GESTURE_CACHE.has(text)) return GESTURE_CACHE.get(text)
    const words = text.split(/\s+/).filter(w => w.length > 0)
    let result, lastErr
    for (const model of GEMINI_MODELS) {
        try { result = await analyzeTextWithGemini(text, model); lastErr = null; break }
        catch (e) { lastErr = e; console.warn(`[GESTURE] Gemini ${model} failed:`, e.message || e) }
    }
    if (!result || !Array.isArray(result.gestures)) {
        if (lastErr) console.warn('[GESTURE] All Gemini models failed, using fallback:', lastErr.message || lastErr)
        result = await keywordFallback(text, words)
    }
    console.log('[GESTURE] result:', JSON.stringify(result))
    GESTURE_CACHE.set(text, result)
    return result
}

export async function generateChatResponse(userText, history) {
    const model = GEMINI_MODELS[0] || 'gemini-1.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    
    const systemPrompt = "Kamu adalah asisten virtual cerdas bernama AI Avatar. Kamu WAJIB MERESPON HANYA MENGGUNAKAN BAHASA INDONESIA dalam segala situasi, terlepas dari bahasa apa pun yang digunakan oleh pengguna atau dari negara mana pun mereka berasal. Jawablah setiap pertanyaan dengan bahasa Indonesia yang natural, ramah, dan profesional. Usahakan singkat, padat, dan jelas layaknya percakapan lisan."
    
    const contents = [...history, { role: 'user', parts: [{ text: userText }] }]
    
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: contents,
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
            }),
            signal: controller.signal
        })
        clearTimeout(timeout)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
        const data = await resp.json()
        const parts = data?.candidates?.[0]?.content?.parts
        const raw = Array.isArray(parts) ? parts.map(p => p.text).filter(Boolean).join('') : null
        if (!raw) throw new Error('Gemini: empty response')
        return raw.trim()
    } catch (e) {
        clearTimeout(timeout)
        console.error('[CHAT] Gemini failed:', e)
        return "Maaf, saya sedang mengalami gangguan pikiran sesaat. Bisakah Anda mengulanginya?"
    }
}
