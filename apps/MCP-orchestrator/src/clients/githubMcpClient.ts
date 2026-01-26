import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class GitHubMcpClient {
  private client: Client;
  private transport?: StdioClientTransport;

  constructor() {
    this.client = new Client({
      name: "github-orchestrator",
      version: "1.0.0",
    }, {
      capabilities: {}
    });
  }

  async connect(token: string) {
    if (!token) {
      throw new Error("GitHub token is required");
    }

    this.transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        ...process.env,
        GITHUB_PERSONAL_ACCESS_TOKEN: token,
      },
    });

    await this.client.connect(this.transport);
  }

  async listTools() {
    return await this.client.listTools();
  }

  async callTool(name: string, args: Record<string, unknown>) {
    return await this.client.callTool({ name, arguments: args });
  }

  async close() {
    await this.client.close();
  }
}
