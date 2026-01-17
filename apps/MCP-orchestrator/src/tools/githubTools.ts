import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GitHubMcpClient } from "../clients/githubMcpClient.js";
import { handleToolError } from "../utils/errorHandler.js";
import "../utils/envLoader.js";

export function registerGitHubTools(server: McpServer) {
  const client = new GitHubMcpClient();
  
  server.registerTool(
    "github_search_repositories",
    {
      description: "Fetch all repositories for the authenticated GitHub user",
      inputSchema: z.object({
        token: z.string().optional().describe("GitHub PAT"),
      }),
    },
    async ({ token }) => {
      const githubToken = token || process.env.GITHUB_TOKEN;
      if (!githubToken) {
        throw new Error("GitHub token not found. Provide it as parameter or set GITHUB_TOKEN in .env file");
      }
      
      try {
        await client.connect(githubToken);
        
        const data = await client.callTool("search_repositories", {
          query: "user:@me",
        });
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      } finally {
        await client.close();
      }
    }
  );

  server.registerTool(
    "github_get_file_contents",
    {
      description: "Get contents of a file or directory for the authenticated GitHub user",
      inputSchema: z.object({
        token: z.string().optional().describe("GitHub PAT"),
        owner: z.string().describe("Owner of the repository"),
        repo: z.string().describe("Name of the repository"),
        path: z.string().describe("Path to file/directory"),
      }),
    },
    async ({ token, owner, repo, path }) => {
      const githubToken = token || process.env.GITHUB_TOKEN;
      if (!githubToken) {
        throw new Error("GitHub token not found. Provide it as parameter or set GITHUB_TOKEN in .env file");
      }
      
      try {
        await client.connect(githubToken);
        
        const data = await client.callTool("get_file_contents", {
          owner: owner,
          repo: repo,
          path: path,
        });
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      } finally {
        await client.close();
      }
    }
  );
}
