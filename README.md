# AgentHub

## Development

1. Start the Python service (example):

```bash
uvicorn main:app --reload --port 8000
```

2. Start the Next.js app:

```bash
npm run dev
```

> During development, keep `next dev` and `uvicorn` running at the same time.

## Environment

Create a `.env.local` file if needed:

```bash
PYTHON_SERVICE_URL=http://localhost:8000
```
