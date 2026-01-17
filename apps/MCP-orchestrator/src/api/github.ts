import { GitHubMcpClient } from "../clients/githubMcpClient.js";

export async function handleGitHubRequest(token: string) {
  const client = new GitHubMcpClient();
  
  try {
    await client.connect(token);
    
    const result = await client.callTool("search_repositories", {
      query: "user:@me",
    });
    
    return result;
  } finally {
    await client.close();
  }
}
