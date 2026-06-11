# AI Avatar - 3D Talking Avatar

Avatar 3D presenter berbahasa Indonesia dengan ekspresi wajah, gerakan tangan alami, dan sinkronasi bibir real-time.

**Demo:** https://3d-avatar-psi.vercel.app/
<img width="962" height="1130" alt="image" src="https://github.com/user-attachments/assets/777113d3-b8d0-4105-95c5-a734e0d17880" />

## Fitur

- 3D avatar dengan animasi morph target (ARKit + Oculus Visemes)
- Facial expressions: happy, excited, sad, angry, neutral
- Gestur tangan: handup, index, ok, thumbup, thumbdown, side, shrug, namaste
- Lip sync real-time dengan syllable-level timing
- Eye blinking otomatis
- Idle animation (mikro-gerakan alis, mata, mulut)
- Mood detection dari teks via InSet lexicon + NLP.js
- Gesture scheduling via Gemini AI + fallback keyword system
- Formal presenter pose (straight)

## Tech Stack

- [TalkingHead](https://github.com/met4citizen/TalkingHead) (Three.js-based 3D avatar)
- [@nlpjs/lang-id](https://www.npmjs.com/package/@nlpjs/lang-id) (sentiment analysis + stemming)
- Vite (bundler)
- Web Speech API (TTS)
- Gemini API (gesture scheduling)

## Local Development

```bash
npm install
cp .env.example .env   # isi VITE_GEMINI_KEY
npm run dev            # http://localhost:8000
```

## Deployment

```bash
npm run build    # output di dist/
```

Deploy `dist/` ke static host (Vercel, Netlify, dll). Set environment variable `VITE_GEMINI_KEY` di hosting.
