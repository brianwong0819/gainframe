// Members of this Cognito group may use the AI features; everyone else keeps
// every other feature ("Who can use AI" in docs/ai.md). The API enforces it from
// the verified access token; the web app reads the same claim to choose what
// to show.
export const AI_GROUP = 'ai'

export function groupsAllowAi(groups: readonly string[]): boolean {
  return groups.includes(AI_GROUP)
}
