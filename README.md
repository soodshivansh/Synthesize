# Synthesize

## Flow

UI (chat-interface.tsx)
  ↓ POST /api/chat (with cookies)
API (api.ts)
  ↓ extracts github_access_token cookie
groqService.generateText()
  ↓ prefetchContext(token)
  │   ├─ fetchAuthenticatedUser(token) → gets user profile
  │   └─ github_proxy({ listTools: true }) → gets available MCP tools
  ↓ buildSystemPrompt(context)
  │   └─ injects username, user info, and tool list into prompt
  ↓ calls Groq LLM (with tools + system prompt)
  ↓ if tool_calls:
  │   ├─ injects token into args
  │   ├─ executes tool handler
  │   └─ sends results back to LLM for final response
  ↓ returns response
