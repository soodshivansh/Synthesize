import { Groq } from 'groq-sdk';
import '../utils/envLoader.js';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function generateText(prompt: string) {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    max_completion_tokens: 1024,
    stream: false
  });

  return chatCompletion.choices[0]?.message?.content || '';
}

