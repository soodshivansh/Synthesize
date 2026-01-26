import '../utils/envLoader.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGitHubTools } from '../tools/githubTools.js';
import { generateText } from './groqService.js';

async function test() {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  registerGitHubTools(server);
  
  try {
    const result = await generateText('Get the GitHub profile for user soodshivansh');
    console.log('Generated text:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
