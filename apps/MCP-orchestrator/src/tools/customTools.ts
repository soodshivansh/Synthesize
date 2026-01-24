import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerToolForGroq } from "../services/groqService.js";
import { handleToolError } from "../utils/errorHandler.js";
import { GitHubMcpClient } from "../clients/githubMcpClient.js";
import "../utils/envLoader.js";

const README_PROMPT = `Analyze this project structure and generate README content with:

1. Project title and 3-4 line description
2. Key features (3-5 bullet points)
3. Tech stack used
4. Usage example
5. Project structure overview

Return ONLY the markdown content, no additional text. Be concise and developer-friendly.`;

const TOOL_USAGE_GUIDANCE = `IMPORTANT: Before asking the user for repository information:
1. Use available tools to discover the GitHub username (try get_github_user or github_proxy tool first)
2. Use available tools to infer the repository name (check github_proxy tool)
3. Once discovered, ask the user to CONFIRM the values, don't ask them to provide from scratch
4. Only ask the user directly if tools cannot discover the information`;

export function registerCustomTools(server: McpServer) {
  const generateReadmeSchema = z.object({
    owner: z.string().optional().describe("Repository owner. IMPORTANT: Try to discover this using get_github_user or github_proxy tool before asking the user. If discovered, ask user for confirmation only."),
    repo: z.string().optional().describe("Repository name. IMPORTANT: Try to infer this from github_proxy tool before asking the user. If discovered, ask user for confirmation only."),
    branch: z.string().optional().describe("Branch name (default: main)"),
  });

  const generateReadmeHandler = async ({ owner, repo, branch = "main" }: any) => {
    if (!owner || !repo) {
      throw new Error("Owner and repo are required. Use available tools to discover these values before calling this tool.");
    }
    
    const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!githubToken) throw new Error("GITHUB_PERSONAL_ACCESS_TOKEN not set");

    const client = new GitHubMcpClient();
    
    try {
      await client.connect(githubToken);
      
      // Fetch repo structure
      const data = await client.callTool("get_file_contents", {
        owner,
        repo,
        path: ""
      });
      
      const structure = JSON.stringify(data, null, 2);
      
      return {
        structure,
        instructions: `${README_PROMPT}. Use github_proxy tool with create_or_update_file to create README.md in ${owner}/${repo} on branch ${branch} with this content.`
      };
    } finally {
      await client.close();
    }
  };

  registerToolForGroq({
    name: "generate_readme",
    description: `Analyze repository structure and generate README.md content. Returns content and instructions to create the file using github_proxy tool. ${TOOL_USAGE_GUIDANCE}`,
    inputSchema: generateReadmeSchema,
    handler: generateReadmeHandler,
  });

  server.registerTool(
    "generate_readme",
    {
      description: `Analyze repository structure and generate README.md content. Returns content and instructions to create the file using github_proxy tool. ${TOOL_USAGE_GUIDANCE}`,
      inputSchema: generateReadmeSchema,
    },
    async ({ owner, repo, branch }: any) => {
      try {
        const data = await generateReadmeHandler({ owner, repo, branch });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}