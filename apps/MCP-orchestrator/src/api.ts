import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGitHubTools } from './tools/githubTools.js';
import { generateText } from './services/groqService.js';
import './utils/envLoader.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = new McpServer({
  name: 'github-orchestrator',
  version: '1.0.0',
});

registerGitHubTools(server);

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await generateText(message);
    res.json({ response });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
