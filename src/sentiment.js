import { Container } from '@nlpjs/core'
import { SentimentAnalyzer } from '@nlpjs/sentiment'
import { LangId } from '@nlpjs/lang-id'

let ready = false
let container
let sentiment

async function ensureInit() {
    if (ready) return
    container = new Container()
    container.use(LangId)
    sentiment = new SentimentAnalyzer({ container })
    await sentiment.process({ locale: 'id', text: 'init' })
    ready = true
}

export async function analyzeSentiment(text) {
    await ensureInit()
    const result = await sentiment.process({ locale: 'id', text, type: 'senticon' })
    return {
        score: result.sentiment.score,
        average: result.sentiment.average,
        wordCount: result.sentiment.numWords,
        numHits: result.sentiment.numHits,
        vote: result.sentiment.vote,
    }
}

function detectAngryKeywords(text) {
    const lower = text.toLowerCase()
    return /\b(marah|benci|kesal|sebal|jengkel|geram|mengamuk|brutal|kejam|bengis|membenci|memarahi|mengamuk|meluapkan)\b/.test(lower)
}

export async function sentimentToMood(text) {
    await ensureInit()
    const result = await sentiment.process({ locale: 'id', text, type: 'senticon' })
    const { score, numHits, vote } = result.sentiment
    const hasQuestion = /[?？]/g.test(text)
    const hasExclamation = /[!！]/g.test(text)
    const qCount = (text.match(/[?？]/g) || []).length

    if (text.includes('😊') || text.includes('😄') || text.includes('🥰') || text.includes('😁')) return 'happy'
    if (text.includes('😢') || text.includes('😭') || text.includes('😞') || text.includes('🥺')) return 'sad'
    if (text.includes('😡') || text.includes('🤬') || text.includes('😤') || text.includes('😠')) return 'angry'

    if (numHits === 0) {
        if (qCount > 1) return 'excited'
        if (hasExclamation) return 'excited'
        if (hasQuestion) return 'excited'
        return 'neutral'
    }

    if (vote === 'positive') {
        if (score >= 5 && hasExclamation) return 'excited'
        if (hasExclamation) return 'excited'
        return 'happy'
    }
    if (vote === 'negative') {
        if (detectAngryKeywords(text) || score <= -5) return 'angry'
        return 'sad'
    }

    if (qCount > 1 || (hasQuestion && hasExclamation)) return 'excited'
    if (hasExclamation) return 'excited'
    if (hasQuestion) return 'excited'

    return 'neutral'
}
