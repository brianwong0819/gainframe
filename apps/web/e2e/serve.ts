// The server Playwright starts for the e2e tests (playwright.config.ts).
import { createSiteServer } from './site-server.ts'

createSiteServer().listen(Number(process.env.PORT ?? '4173'))
