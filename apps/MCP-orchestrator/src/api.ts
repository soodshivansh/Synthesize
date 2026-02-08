import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGitHubTools } from './tools/githubTools.js';
import { registerCustomTools } from './tools/customTools.js';
import { generateText } from './services/groqService.js';
import './utils/envLoader.js';

const app = express();
app.use(cors({ credentials: true, origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(cookieParser());

const server = new McpServer({
  name: 'github-orchestrator',
  version: '1.0.0',
});

registerGitHubTools(server);
registerCustomTools(server);

// will be using SSE approach for streaming later
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    
    // Get token from Authorization header or cookie (fallback)
    const authHeader = req.headers.authorization;
    const githubToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : req.cookies.github_access_token;
    
    console.log('Chat request received:', { message, hasToken: !!githubToken });
    
    const response = await generateText(message, conversationHistory, githubToken);
    res.json({ response });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
