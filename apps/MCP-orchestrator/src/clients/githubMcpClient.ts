import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class GitHubMcpClient {
  private client: Client;
  private transport?: StdioClientTransport;
  private connected = false;

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

    try {
      this.transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          ...process.env,
          GITHUB_PERSONAL_ACCESS_TOKEN: token,
        },
      });

      await this.client.connect(this.transport);
      this.connected = true;
    } catch (error: any) {
      console.error("Failed to connect to GitHub MCP server:", error.message);
      throw new Error(`MCP connection failed: ${error.message}`);
    }
  }

  async listTools() {
    if (!this.connected) {
      throw new Error("MCP client not connected");
    }
    try {
      return await this.client.listTools();
    } catch (error: any) {
      console.error("Failed to list tools:", error.message);
      throw new Error(`Failed to list tools: ${error.message}`);
    }
  }

  async callTool(name: string, args: Record<string, unknown>) {
    if (!this.connected) {
      throw new Error("MCP client not connected");
    }
    try {
      console.log(`Calling MCP tool: ${name} with args:`, JSON.stringify(args));
      const result = await this.client.callTool({ name, arguments: args });
      return result;
    } catch (error: any) {
      console.error(`Failed to call tool ${name}:`, error.message);
      throw new Error(`Tool ${name} failed: ${error.message}`);
    }
  }

  async close() {
    if (this.connected) {
      try {
        await this.client.close();
      } catch (error: any) {
        console.error("Error closing MCP client:", error.message);
      }
      this.connected = false;
    }
  }
}
