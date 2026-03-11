# Aerie Revenue Machine

A full-stack sales execution app for GTM teams.

## What it does

- **Feature 1: BDR/AE Outreach Assistant**
  - Generates a multi-touch outbound sequence from lead/account + context inputs.
- **Feature 2: Pragmatic Business Score Calculator**
  - Computes weighted readiness score and recommendation tiers.
- **Feature 3: Cross-Platform Intelligence Agent**
  - Ingests ZoomInfo + Sales Nav + intent + web clues and optional SFDC CSV text for analysis.

## Run locally

```bash
npm start
```

Then open:

```text
http://localhost:4173
```

## API endpoints

- `GET /api/health`
- `GET /api/context`
- `POST /api/context`
- `POST /api/outreach`
- `POST /api/score`
- `POST /api/intel`

The backend is implemented in `server.js` and serves both static files and JSON APIs.
