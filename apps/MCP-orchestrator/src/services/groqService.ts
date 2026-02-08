import { Groq } from 'groq-sdk';
import '../utils/envLoader.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<any>;
}

interface PreFetchedContext {
  authenticatedUser: any | null;
  availableGitHubTools: any[] | null;
}

let registeredTools: ToolDefinition[] = [];

export function registerToolForGroq(tool: ToolDefinition) {
  registeredTools.push(tool);
}

async function fetchAuthenticatedUser(token: string): Promise<any> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }
  return await response.json();
}

async function prefetchContext(githubToken?: string): Promise<PreFetchedContext> {
  const context: PreFetchedContext = {
    authenticatedUser: null,
    availableGitHubTools: null
  };

  if (githubToken) {
    // Fetch authenticated user directly with the provided token
    try {
      context.authenticatedUser = await fetchAuthenticatedUser(githubToken);
    } catch (e) {
      // User not authenticated or token invalid
    }

    // Fetch available GitHub MCP tools
    const proxyTool = registeredTools.find(t => t.name === 'github_proxy');
    if (proxyTool) {
      try {
        const result = await proxyTool.handler({ token: githubToken, listTools: true });
        context.availableGitHubTools = result?.tools || [];
      } catch (e) {
        // MCP tools unavailable
      }
    }
  }

  return context;
}

function buildSystemPrompt(context: PreFetchedContext): string {
  const toolList = registeredTools.map(t => `- ${t.name}: ${t.description}`).join('\n');
  
  let userContext = '';
  if (context.authenticatedUser) {
    userContext = `
## Authenticated User (use this info, don't call get_authenticated_github_user)
- Username: ${context.authenticatedUser.login}
- Name: ${context.authenticatedUser.name || 'N/A'}
- ID: ${context.authenticatedUser.id}
- Public Repos: ${context.authenticatedUser.public_repos}`;
  }

  let mcpToolsContext = '';
  if (context.availableGitHubTools?.length) {
    const toolsSummary = context.availableGitHubTools
      .map((t: any) => `  - ${t.name}: ${t.description}`)
      .join('\n');
    mcpToolsContext = `
## Available GitHub MCP Tools (via github_proxy)
${toolsSummary}`;
  }

  return `You are a helpful GitHub assistant with access to tools.
${userContext}
${mcpToolsContext}

## Direct Tools
${toolList}

## Rules
1. NEVER guess usernames or tokens - use the authenticated user info above.
2. Tokens are injected automatically - never ask for them.
3. For "my" queries, use the authenticated username: ${context.authenticatedUser?.login || '[not authenticated]'}
4. Use github_proxy with toolName and toolArgs to call MCP tools listed above.

## Common Patterns
- "List my repos" → Use github_proxy with toolName="search_repositories" and toolArgs={"query": "user:${context.authenticatedUser?.login || 'USERNAME'}"}
- "Search repos" → Use github_proxy with toolName="search_repositories" and toolArgs={"query": "<search terms>"}
- "Get repo info" → Use github_proxy with toolName="get_repository" and appropriate args
- "Create issue" → Use github_proxy with toolName="create_issue" and appropriate args

Always construct the correct query/args based on the authenticated user info provided above.`;
}

const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX_RETRIES = 2;

export async function generateText(prompt: string, conversationHistory: any[] = [], githubToken?: string) {
  // Pre-fetch context once before LLM call
  const context = await prefetchContext(githubToken);
  
  const tools = registeredTools.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema)
    }
  }));
  
  const systemMessage = { role: "system", content: buildSystemPrompt(context) };
  
  const messages: any[] = [
    systemMessage,
    ...conversationHistory,
    { role: "user", content: prompt }
  ];
  
  let retries = 0;
  
  while (retries <= MAX_RETRIES) {
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages,
        model: GROQ_MODEL,
        temperature: 0.7,
        max_completion_tokens: 1024,
        stream: false,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: "auto"
      });

      const message = chatCompletion.choices[0]?.message;
      
      if (message?.tool_calls) {
        messages.push(message);
        
        for (const toolCall of message.tool_calls) {
          const tool = registeredTools.find(t => t.name === toolCall.function.name);
          if (tool) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              
              if (githubToken) {
                args.token = githubToken;
              }
              const result = await tool.handler(args);
              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
              });
            } catch (error: any) {
              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message })
              });
            }
          }
        }
        
        const finalCompletion = await groq.chat.completions.create({
          messages,
          model: GROQ_MODEL,
          temperature: 0.7,
          max_completion_tokens: 1024,
          stream: false
        });
        
        return finalCompletion.choices[0]?.message?.content || '';
      }

      // Check if LLM returned tool call syntax as text (common issue with some models)
      const content = message?.content || '';
      
      // Pattern to match: github_proxy(toolName="...", toolArgs={...})
      // Using a more robust extraction approach
      const toolCallMatch = content.match(/github_proxy\s*\(\s*toolName\s*=\s*["']([^"']+)["']\s*,\s*toolArgs\s*=\s*(\{.*\})\s*\)/s);
      
      if (toolCallMatch) {
        const [, toolName, toolArgsStr] = toolCallMatch;
        const tool = registeredTools.find(t => t.name === 'github_proxy');
        
        if (tool) {
          try {
            // Parse toolArgs - handle both single and double quotes
            const normalizedArgs = toolArgsStr.replace(/'/g, '"');
            const toolArgs = JSON.parse(normalizedArgs);
            
            console.log(`Detected text-based tool call: github_proxy(${toolName})`, toolArgs);
            
            const result = await tool.handler({ 
              token: githubToken, 
              toolName, 
              toolArgs 
            });
            
            // Ask LLM to format the result nicely
            const formatMessages: any[] = [
              { role: "system", content: "You are a helpful assistant. Format the following GitHub API response in a clear, readable way for the user. Be concise and highlight the important information. Use markdown formatting." },
              { role: "user", content: `The user asked: "${prompt}"\n\nHere's the GitHub API response:\n${JSON.stringify(result, null, 2)}` }
            ];
            
            const formatCompletion = await groq.chat.completions.create({
              messages: formatMessages,
              model: GROQ_MODEL,
              temperature: 0.5,
              max_completion_tokens: 1024,
              stream: false
            });
            
            return formatCompletion.choices[0]?.message?.content || JSON.stringify(result, null, 2);
          } catch (error: any) {
            console.error('Error executing text-based tool call:', error);
            return `I tried to fetch your GitHub data but encountered an error: ${error.message}`;
          }
        }
      }

      return content;
      
    } catch (error: any) {
      // Check if it's a tool validation error
      if (error?.error?.type === 'invalid_request_error' && error?.error?.code === 'tool_use_failed') {
        retries++;
        
        if (retries <= MAX_RETRIES) {
          // Add error feedback to messages so LLM can correct itself
          const errorDetails = error?.error?.message || 'Tool call validation failed';
          const failedGeneration = error?.error?.failed_generation || '';
          
          messages.push({
            role: "user",
            content: `Your previous tool call failed with error: "${errorDetails}". 
Failed parameters: ${failedGeneration}

Please fix the parameters and try again. Remember:
- listTools must be a boolean (true/false), not a string
- token should be omitted (it's injected automatically)
- Ensure all parameter types match the schema exactly`
          });
          
          console.log(`Tool call failed, retrying (${retries}/${MAX_RETRIES})...`);
          continue;
        }
      }
      
      // If not a tool error or max retries reached, throw
      throw error;
    }
  }
  
  return 'Sorry, I encountered repeated errors trying to process your request. Please try rephrasing.';
}

