#!/usr/bin/env node
// Starts the StarNG MCP server on stdio. An agent runs it with `npx -y @star-ng/mcp`.
import { runServer } from '../src/server.mjs';

runServer();
