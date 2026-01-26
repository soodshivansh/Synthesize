import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GitHubMcpClient } from "../clients/githubMcpClient.js";
import { handleToolError } from "../utils/errorHandler.js";
import { registerToolForGroq } from "../services/groqService.js";
import "../utils/envLoader.js";

export function registerGitHubTools(server: McpServer) {
  const getUserSchema = z.object({
    username: z.string().describe("GitHub username"),
  });
  
  const getUserHandler = async ({ username }: any) => {
    const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!githubToken) {
      throw new Error("GITHUB_PERSONAL_ACCESS_TOKEN not set");
    }
    
    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }
    
    return await response.json();
  };
  
  registerToolForGroq({
    name: "get_github_user",
    description: "Get GitHub user profile information",
    inputSchema: getUserSchema,
    handler: getUserHandler
  });
  
  server.registerTool(
    "get_github_user",
    {
      description: "Get GitHub user profile information",
      inputSchema: getUserSchema,
    },
    async ({ username }: any) => {
      try {
        const data = await getUserHandler({ username });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  const proxySchema = z.object({
    token: z.string().optional().describe("GitHub PAT"),
    listTools: z.boolean().optional().describe("Set to true to list all available tools"),
    toolName: z.string().optional().describe("Name of the tool to call"),
    toolArgs: z.record(z.unknown()).optional().describe("Arguments for the tool"),
  });
  
  const proxyHandler = async ({ token, listTools, toolName, toolArgs }: any) => {
    const githubToken = token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!githubToken) {
      throw new Error("GitHub token not provided and GITHUB_PERSONAL_ACCESS_TOKEN not set");
    }
    const client = new GitHubMcpClient();
    
    try {
      await client.connect(githubToken);
      
      if (listTools) {
        return await client.listTools();
      }
      
      if (!toolName) {
        throw new Error("toolName is required when listTools is false");
      }
      
      return await client.callTool(toolName, toolArgs || {});
    } finally {
      await client.close();
    }
  };
  
  registerToolForGroq({
    name: "github_proxy",
    description: "Proxy to GitHub MCP server. First call with listTools=true to discover available tools, then call specific tools.",
    inputSchema: proxySchema,
    handler: proxyHandler
  });

  server.registerTool(
    "github_proxy",
    {
      description: "Proxy to GitHub MCP server. First call with listTools=true to discover available tools, then call specific tools.",
      inputSchema: proxySchema,
    },
    async ({ token, listTools, toolName, toolArgs }: any) => {
      try {
        const data = await proxyHandler({ token, listTools, toolName, toolArgs });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
