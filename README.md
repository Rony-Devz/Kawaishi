# Kawaishi Ju-Jitsu

A Hebrew-first (RTL), installable training app (PWA) for the dojo I train at, based on our curriculum and syllabus. The app includes: belt progression, daily training sessions, flashcard quizzes, series-ordering drills, shadow training, and a full technique library with illustrations.

## 🔗 Live app

**https://rony-devz.github.io/Kawaishi/**

## 📲 Install on your phone

It works in any browser, and can be installed like a native app:

- **iPhone / iPad (Safari):** open the link → tap **Share** → **Add to Home Screen**.
- **Android (Chrome):** open the link → tap the **Install app** / **Add to Home Screen** prompt.

Once installed it opens full-screen and works offline.

## ✨ Features

- Belt-by-belt syllabus with progress tracking and mastery levels (earned through practice, never self-assigned).
- Daily training sessions driven by a customizable weekly plan.
- Bi-directional flashcard quizzes (illustration → Japanese, or illustration + Japanese → Hebrew).
- Series-ordering drills — arrange a series' techniques in the correct order.
- Shadow training for text-based self-defense techniques.
- Full technique library with illustrations, videos, and tap-to-enlarge.
- 100% static, installable, and offline-capable.

## 🛠️ Tech

Single-page static PWA — HTML/CSS/vanilla JS with a service worker for offline caching. No build step. Data lives in `data.js`.
