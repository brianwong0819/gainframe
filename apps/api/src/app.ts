import { Hono } from 'hono'

// CloudFront forwards `/api/*` to the Lambda without stripping the prefix,
// so every route is mounted under `/api`.
export const app = new Hono().basePath('/api')

app.get('/health', (c) => c.json({ status: 'ok' }))
