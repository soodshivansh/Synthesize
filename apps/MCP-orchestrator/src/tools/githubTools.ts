import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleGitHubRequest } from "../api/github.js";
import dotenv from "dotenv";

dotenv.config();

export function registerGitHubTools(server: McpServer) {
  server.registerTool(
    "fetch_github_data",
    {
      description: "Fetch all repositories for the authenticated GitHub user",
      inputSchema: z.object({
        token: z.string().optional().describe("GitHub Personal Access Token (optional, reads from .env if not provided)"),
      }),
    },
    async ({ token }) => {
      try {
        const githubToken = token || process.env.GITHUB_TOKEN;
        if (!githubToken) {
          throw new Error("GitHub token not found. Provide it as parameter or set GITHUB_TOKEN in .env file");
        }
        const data = await handleGitHubRequest(githubToken);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}
