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
  let userContext = '';
  if (context.authenticatedUser) {
    userContext = `
## Authenticated User
- Username: ${context.authenticatedUser.login}
- Name: ${context.authenticatedUser.name || 'N/A'}
- ID: ${context.authenticatedUser.id}
- Public Repos: ${context.authenticatedUser.public_repos}`;
  }

  return `You are a helpful GitHub assistant. You have access to function tools - USE THEM, don't describe them.
${userContext}

CRITICAL RULES:
1. When user asks to list repos, search repos, or any GitHub action - CALL THE TOOL IMMEDIATELY using function calling.
2. DO NOT write out tool calls as text or JSON. Use the actual function calling mechanism.
3. DO NOT explain what you're going to do. Just do it.
4. DO NOT say "Let me try" or "I will call". Just call the function.
5. For "my repos" or "my repositories", use github_proxy with toolName="search_repositories" and toolArgs={"query": "user:${context.authenticatedUser?.login || 'USERNAME'}"}
6. Token is automatic - never include it in args.

WRONG (don't do this):
"Let me call github_proxy with listTools=true..."
{"name": "github_proxy", "parameters": {...}}

RIGHT (do this):
[Actually call the github_proxy function using function calling]`;
}

const GROQ_MODEL = "qwen/qwen3-32b";
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
      
      // Detect if LLM is describing tool calls instead of executing them
      const isDescribingToolCall = 
        content.includes('"name": "github_proxy"') ||
        content.includes("github_proxy") && content.includes("listTools") ||
        content.includes("search_repositories") ||
        content.match(/\{\s*"name"\s*:\s*"github_proxy"/);
      
      // Also detect common user intents that should trigger tool calls
      const lowerPrompt = prompt.toLowerCase();
      const wantsRepoList = 
        (lowerPrompt.includes('list') && lowerPrompt.includes('repo')) ||
        (lowerPrompt.includes('my') && lowerPrompt.includes('repo')) ||
        (lowerPrompt.includes('show') && lowerPrompt.includes('repo')) ||
        lowerPrompt.includes('my repositories');
      
      // If LLM failed to call tools properly, execute directly
      if ((isDescribingToolCall || wantsRepoList) && context.authenticatedUser && githubToken) {
        const tool = registeredTools.find(t => t.name === 'github_proxy');
        
        if (tool) {
          try {
            console.log('LLM failed to use function calling, executing tool directly');
            
            const result = await tool.handler({ 
              token: githubToken, 
              toolName: 'search_repositories',
              toolArgs: { query: `user:${context.authenticatedUser.login}` }
            });
            
            // Format the result nicely
            const formatMessages: any[] = [
              { role: "system", content: "Format this GitHub repository list in a clean, readable way. Use markdown. Show repo name, description, stars, and language. Be concise." },
              { role: "user", content: `User asked: "${prompt}"\n\nRepositories:\n${JSON.stringify(result, null, 2)}` }
            ];
            
            const formatCompletion = await groq.chat.completions.create({
              messages: formatMessages,
              model: GROQ_MODEL,
              temperature: 0.3,
              max_completion_tokens: 1024,
              stream: false
            });
            
            return formatCompletion.choices[0]?.message?.content || JSON.stringify(result, null, 2);
          } catch (error: any) {
            console.error('Error executing direct tool call:', error);
            return `I tried to fetch your GitHub repositories but encountered an error: ${error.message}`;
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

