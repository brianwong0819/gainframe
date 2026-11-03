import { defineConfig } from 'rolldown'

// Bundles the Lambda handler and its dependencies into one ES module, so the
// deployment zip holds a single file and needs no node_modules.
export default defineConfig({
  input: 'src/lambda.ts',
  platform: 'node',
  // Optional native binding that pg loads only when asked for; not used.
  external: ['pg-native'],
  output: {
    file: 'dist/lambda/index.mjs',
    format: 'esm',
    minify: true,
    sourcemap: true,
    // The AWS SDK loads some modules lazily; inline them to keep a single file.
    codeSplitting: false,
  },
})
