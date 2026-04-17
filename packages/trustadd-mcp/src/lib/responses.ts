/** MCP tool content builders. */

export function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export type ToolResult = ReturnType<typeof textResult> | ReturnType<typeof errorResult>;
