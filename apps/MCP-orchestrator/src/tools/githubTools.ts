import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GitHubMcpClient } from "../clients/githubMcpClient.js";
import { handleToolError } from "../utils/errorHandler.js";
import { registerToolForGroq } from "../services/groqService.js";
import "../utils/envLoader.js";

export function registerGitHubTools(server: McpServer) {
  // Tool to get authenticated user's profile
  const getAuthenticatedUserSchema = z.object({
    token: z.string().optional().describe("GitHub token (injected automatically)")
  });
  
  const getAuthenticatedUserHandler = async ({ token }: { token?: string }) => {
    const githubToken = token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!githubToken) {
      throw new Error("GitHub token not provided and GITHUB_PERSONAL_ACCESS_TOKEN not set");
    }
    
    const response = await fetch(`https://api.github.com/user`, {
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
    name: "get_authenticated_github_user",
    description: "Get the currently authenticated user's GitHub profile. ALWAYS call this first when user asks about 'my' profile, repos, or any personal information. Returns username, id, email, and other profile data.",
    inputSchema: getAuthenticatedUserSchema,
    handler: getAuthenticatedUserHandler
  });
  
  server.registerTool(
    "get_authenticated_github_user",
    {
      description: "Get the authenticated GitHub user's profile information using the token",
      inputSchema: getAuthenticatedUserSchema,
    },
    async () => {
      try {
        const data = await getAuthenticatedUserHandler({});
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  const proxySchema = z.object({
    token: z.string().optional().describe("GitHub PAT - leave empty, injected automatically"),
    listTools: z.union([z.boolean(), z.string()]).optional().describe("Set to true to list all available tools"),
    toolName: z.string().optional().describe("Name of the tool to call"),
    toolArgs: z.record(z.unknown()).optional().describe("Arguments for the tool"),
  });
  
  const proxyHandler = async ({ token, listTools, toolName, toolArgs }: any) => {
    const githubToken = token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!githubToken) {
      throw new Error("GitHub token not provided and GITHUB_PERSONAL_ACCESS_TOKEN not set");
    }
    
    // Coerce listTools to boolean (LLM sometimes sends "true"/"false" as strings)
    const shouldListTools = listTools === true || listTools === "true";
    
    const client = new GitHubMcpClient();
    
    try {
      await client.connect(githubToken);
      
      if (shouldListTools) {
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
    description: "Access advanced GitHub operations via MCP server. IMPORTANT: First call with listTools=true to discover all available tools and their parameters. Then call specific tools by name. Token is handled automatically - do not provide it.",
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
