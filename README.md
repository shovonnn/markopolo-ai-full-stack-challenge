# Campaignity

A minimal chat interface that can connect to data sources and simulate streaming of a JSON payload representing "right time, right channel, right message, right audience" for execution as multi-channel campaigns.

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + Server-Sent Events (SSE)

## Demo https://campaignity.owww.work/

## Quick start

1. Install dependencies
2. Run both server and client

See below for details.

### Install and run

In one terminal, install and start the server and client (from the repo root):

```bash
cd server && npm i && npm run dev
```

Open a second terminal:

```bash
cd client && npm i && npm run dev
```

Frontend runs on http://localhost:5173 and proxies API requests to the server at http://localhost:5174.

