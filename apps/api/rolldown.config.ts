import { defineConfig } from 'rolldown'

// Bundles each Lambda handler and its dependencies into one ES module, so each
// deployment zip holds a single file and needs no node_modules.
const lambda = (input: string, dir: string) => ({
  input,
  platform: 'node' as const,
  // Optional native binding that pg loads only when asked for; not used.
  external: ['pg-native'],
  output: {
    file: `dist/${dir}/index.mjs`,
    format: 'esm' as const,
    minify: true,
    sourcemap: true,
    // The AWS SDK loads some modules lazily; inline them to keep a single file.
    codeSplitting: false,
  },
})

export default defineConfig([
  lambda('src/lambda.ts', 'lambda'),
  // The Cognito pre sign-up trigger (infra/modules/auth).
  lambda('src/cognito/pre-sign-up-lambda.ts', 'pre-sign-up'),
])
