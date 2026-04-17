#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { registerAllTools } from "./tools/index.js";
import { registerAllPrompts } from "./prompts/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const server = new McpServer({
  name: pkg.name,
  version: pkg.version,
});

registerAllTools(server);
registerAllPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
