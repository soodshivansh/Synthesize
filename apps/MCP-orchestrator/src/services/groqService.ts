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

let registeredTools: ToolDefinition[] = [];

export function registerToolForGroq(tool: ToolDefinition) {
  registeredTools.push(tool);
}

export async function generateText(prompt: string) {
  const tools = registeredTools.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema)
    }
  }));
  
  const messages: any[] = [{ role: "user", content: prompt }];
  
  const chatCompletion = await groq.chat.completions.create({
    messages,
    model: "llama-3.3-70b-versatile",
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
        const result = await tool.handler(JSON.parse(toolCall.function.arguments));
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }
    
    const finalCompletion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_completion_tokens: 1024,
      stream: false
    });
    
    return finalCompletion.choices[0]?.message?.content || '';
  }

  return message?.content || '';
}

