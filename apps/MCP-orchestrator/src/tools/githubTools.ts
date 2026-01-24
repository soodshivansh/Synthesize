import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GitHubMcpClient } from "../clients/githubMcpClient.js";
import { handleToolError } from "../utils/errorHandler.js";
import "../utils/envLoader.js";

export function registerGitHubTools(server: McpServer) {
  server.registerTool(
    "get_github_user",
    {
      description: "Get GitHub user profile information",
      inputSchema: z.object({
        username: z.string().describe("GitHub username"),
      }),
    },
    async ({ username }: any) => {
      const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!githubToken) {
        throw new Error("GITHUB_PERSONAL_ACCESS_TOKEN not set");
      }
      
      try {
        const response = await fetch(`https://api.github.com/users/${username}`, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
          },
        });
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.registerTool(
    "github_proxy",
    {
      description: "Proxy to GitHub MCP server. First call with listTools=true to discover available tools, then call specific tools.",
      inputSchema: z.object({
        token: z.string().optional().describe("GitHub PAT"),
        listTools: z.boolean().optional().describe("Set to true to list all available tools"),
        toolName: z.string().optional().describe("Name of the tool to call"),
        toolArgs: z.record(z.unknown()).optional().describe("Arguments for the tool"),
      }),
    },
    async ({ token, listTools, toolName, toolArgs }: any) => {
      const githubToken = token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!githubToken) {
        throw new Error("GitHub token not provided and GITHUB_PERSONAL_ACCESS_TOKEN not set");
      }
      const client = new GitHubMcpClient();
      
      try {
        await client.connect(githubToken);
        
        if (listTools) {
          const tools = await client.listTools();
          return {
            content: [{ type: "text", text: JSON.stringify(tools, null, 2) }],
          };
        }
        
        if (!toolName) {
          throw new Error("toolName is required when listTools is false");
        }
        
        const data = await client.callTool(toolName, toolArgs || {});
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      } finally {
        await client.close();
      }
    }
  );
}
