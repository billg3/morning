# morning

**morning** is a Manhattan-inspired AI networking app for live conversations.

## Features

- **AI auto-connect video rooms**: describe your vibe and goal, then auto-join an AI-matched Jitsi room.
- **Live AI radar**: optional browser speech recognition captures transcript snippets during calls.
- **Agent concierge chat**:
  - works locally with built-in conversation suggestions.
  - optional OpenAI integration (drop in API key) for richer recommendations.
- **Nearby network demo**: lightweight local presence feed via `BroadcastChannel` to simulate other users.
- **Manhattan vibe UI**: glassmorphism + skyline-night styling with day/night mode toggle.

## Run locally

No build step required.

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Notes

- Video integration uses Jitsi Meet links for instant browser-based rooms.
- Browser transcription uses `SpeechRecognition` (`webkitSpeechRecognition`), best on Chrome/Edge.
- OpenAI API key stays in-memory only and is not persisted.
