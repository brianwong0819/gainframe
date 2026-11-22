import { z } from 'zod'

// The Cognito managed login origin and the web app client, set at build time
// from the Terraform outputs (deploy.yml). A build without them (prod until
// M2-07, local builds) has no sign-in.
const authConfigSchema = z.object({
  origin: z.url({ protocol: /^https$/ }),
  clientId: z.string().min(1),
})
export type AuthConfig = z.infer<typeof authConfigSchema>

export function readAuthConfig(): AuthConfig | null {
  const result = authConfigSchema.safeParse({
    origin: process.env.NEXT_PUBLIC_AUTH_ORIGIN,
    clientId: process.env.NEXT_PUBLIC_AUTH_CLIENT_ID,
  })
  return result.success ? result.data : null
}
