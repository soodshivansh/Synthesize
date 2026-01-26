export function handleToolError(error: any) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${error.message}`,
      },
    ],
  };
}
