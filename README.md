🌍 LingoCraft (Cloud Hub)

An AI-powered, multi-language learning ecosystem that generates dynamic,
context-aware lessons, tracks vocabulary mastery, and provides interactive audio
drills.

📖 Project Description

LingoCraft is a personalized language-learning platform designed to bridge the
gap between static textbook learning and active fluency. Instead of pre-written
courses, LingoCraft uses the Google Gemini API to dynamically generate cohesive
stories, reading passages, quizzes, and audio drills based on the user's
specific vocabulary database and past performance.

It features a central Cloud Hub where users manage their API keys, monitor
cross-course activity, and launch into specific language environments (e.g.,
Mandarin, Hungarian, Portuguese, Romanian).

✨ Key Features

  - 🧠 AI-Generated Curriculums: Generates custom JSON-based lessons based on an
    active master lexicon and recent user mistakes.
  - 🗣️ Interactive Audio & TTS: Integrated Text-to-Speech (via Gemini) powers
    listen-and-repeat drills, diagnostic sweeps, and dictation exercises.
  - 📚 Smart Lexicon Database: A centralized vocabulary manager that tracks parts
    of speech, definitions, and automatically flags duplicate entries.
  - 📝 Active Recall Testing: Features robust, graded quizzes and active
    translation (English-to-Target) testing with instant feedback.
  - ☁️ Cloud Sync & Note-taking: Built on Firebase, user progress, customized
    grammar notes, and vocabulary lists sync instantly across devices.
  - 🌙 Smart Dark Mode: Device-specific theme tracking that automatically follows
    your OS schedule without forcing preferences across different devices.
  - 🛠️ Import / Export: Easily paste, upload, or download generated JSON lesson
    files.

🧰 Tech Stack

  - Frontend: React.js, React Router
  - Styling: Tailwind CSS, Lucide React (Icons)
  - Backend / Database: Firebase (Firestore & Authentication)
  - AI & Voice: Google Gemini 3.5 Flash API (LLM Context & TTS)

🏗️ Architecture

The application is split into two main concepts:

1.  The Hub (Home.js): The entryway. Handles Google Authentication, API key
    management (Free & Paid Gemini keys), global activity logging, and routing.
2.  Language Modules (LanguageCourse.js): A highly flexible, config-driven
    component that renders the actual learning environment. It dynamically
    adapts to different writing systems (e.g., Traditional Chinese vs. Latin
    alphabet) and feature toggles (Stories, Sweeps, Tests) based on the
    language.

🚀 Getting Started

Prerequisites

  - Node.js installed
  - A Firebase Project (with Firestore and Google Auth enabled)
  - A Google Gemini API Key

Installation

1.  Clone the repository

    git clone https://github.com/filip013/lingocraft.git
    cd lingocraft

2.  Install dependencies

    npm install

3.  Environment Setup Create a .env file in the root directory and add your
    Firebase configuration:

    REACT_APP_FIREBASE_API_KEY=your_api_key
    REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
    REACT_APP_FIREBASE_PROJECT_ID=your_project_id

4.  Run the development server

    npm run dev

5.  Set up AI (In-App) Once the app is running, log in and navigate to the API &
    Config panel on the Home screen to save your Gemini API keys securely to
    your profile.

📝 Roadmap / Future Features

- [x] Cross-language Activity Logging
- [x] Custom User Note Overlays
- [ ] Spaced Repetition System (SRS) integration for Lexicon
- [ ] Mobile-native wrapper (React Native / PWA)

📄 License

This project is licensed under the MIT License - see the LICENSE.md file for
details.

Built with ❤️ by filip013.
