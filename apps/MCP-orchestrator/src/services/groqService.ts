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

  let toolsList = '';
  if (context.availableGitHubTools && context.availableGitHubTools.length > 0) {
    toolsList = `

## GitHub Operations Available Through github_proxy
These are NOT direct function calls. You MUST use github_proxy to access them:
${context.availableGitHubTools.map(t => `- ${t.name}: ${t.description || ''}`).join('\n')}

To use any of these, call: github_proxy(toolName="operation_name", toolArgs={...})`;
  }

  return `You are a helpful GitHub assistant.
${userContext}${toolsList}

YOUR ONLY AVAILABLE FUNCTION CALLS:
1. get_authenticated_github_user() - Get current user profile
2. github_proxy(toolName, toolArgs) - Access GitHub operations

CRITICAL: The operations listed above (get_repository, search_repositories, etc.) are NOT function calls.
They are operations you access THROUGH github_proxy.

Example - WRONG:
get_repository({"owner": "user", "repo": "name"})

Example - CORRECT:
github_proxy({"toolName": "get_repository", "toolArgs": {"owner": "user", "repo": "name"}})

Token is automatic - never include it.

IMPORTANT: DO NOT write tool calls as text in your response. Use the actual function calling mechanism.
DO NOT output things like: github_proxy(toolName="...", toolArgs={...})
Instead, CALL the function directly using the tool calling feature.

FORMATTING: Always format responses in markdown with:
- Use ## for headings
- Use **bold** for emphasis
- Use bullet points with - or *
- Use \`code\` for technical terms
- Use code blocks with \`\`\` for code snippets`;
}

const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX_RETRIES = 2;
const MAX_ITERATIONS = 3;
const QUALITY_THRESHOLD = 0.8;

async function evaluateResponseQuality(response: string, originalPrompt: string): Promise<number> {
  const evalPrompt = `Evaluate this response quality on a scale of 0.0 to 1.0.

Original question: "${originalPrompt}"

Response: "${response}"

Criteria:
- Is it well-formatted with markdown?
- Does it directly answer the question?
- Is it clear and concise?
- Does it avoid showing raw tool calls?

Respond with ONLY a number between 0.0 and 1.0. No explanation.`;

  try {
    const evalCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: evalPrompt }],
      model: GROQ_MODEL,
      temperature: 0.1,
      max_completion_tokens: 10,
      stream: false
    });
    
    const score = parseFloat(evalCompletion.choices[0]?.message?.content || '0');
    return isNaN(score) ? 0 : Math.min(Math.max(score, 0), 1);
  } catch {
    return 0.5;
  }
}

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
  let iteration = 0;
  let bestResponse = '';
  let bestScore = 0;
  
  while (iteration < MAX_ITERATIONS) {
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
        
        const response = finalCompletion.choices[0]?.message?.content || '';
        
        // Evaluate response quality
        const score = await evaluateResponseQuality(response, prompt);
        console.log(`Iteration ${iteration + 1}: Quality score = ${score.toFixed(2)}`);
        
        if (score > bestScore) {
          bestScore = score;
          bestResponse = response;
        }
        
        if (score >= QUALITY_THRESHOLD) {
          console.log(`Quality threshold met (${score.toFixed(2)} >= ${QUALITY_THRESHOLD})`);
          return response;
        }
        
        // Add feedback for improvement
        if (iteration < MAX_ITERATIONS - 1) {
          messages.push({
            role: "assistant",
            content: response
          });
          messages.push({
            role: "user",
            content: `Your response quality score is ${score.toFixed(2)}/1.0. Please improve it by:\n- Using better markdown formatting\n- Being more concise and clear\n- Avoiding raw tool call syntax\n- Directly answering the question`
          });
          iteration++;
          continue;
        }
        
        return bestResponse || response;
      }

      // Check if LLM returned tool call syntax as text (common issue with some models)
      const content = message?.content || '';
      
      // Detect if LLM is describing tool calls instead of executing them
      const isDescribingToolCall = 
        content.includes('github_proxy(') ||
        content.includes('toolName') ||
        content.includes('"name": "github_proxy"') ||
        content.match(/github_proxy\s*\(/);
      
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
              { role: "system", content: "Format this GitHub repository list using markdown. Use ## for headings, **bold** for repo names, bullet points for features. Make it visually appealing and easy to read." },
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

      // Evaluate and iterate on non-tool responses
      const score = await evaluateResponseQuality(content, prompt);
      console.log(`Iteration ${iteration + 1}: Quality score = ${score.toFixed(2)}`);
      
      if (score > bestScore) {
        bestScore = score;
        bestResponse = content;
      }
      
      if (score >= QUALITY_THRESHOLD) {
        console.log(`Quality threshold met (${score.toFixed(2)} >= ${QUALITY_THRESHOLD})`);
        return content;
      }
      
      if (iteration < MAX_ITERATIONS - 1) {
        messages.push({
          role: "assistant",
          content: content
        });
        messages.push({
          role: "user",
          content: `Your response quality score is ${score.toFixed(2)}/1.0. Please improve it by using better markdown formatting, being more concise, and directly answering the question.`
        });
        iteration++;
        continue;
      }

      return bestResponse || content;
      
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
  
  return bestResponse || 'Sorry, I encountered repeated errors trying to process your request. Please try rephrasing.';
}

