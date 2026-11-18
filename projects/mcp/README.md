# @star-ng/mcp

An MCP (Model Context Protocol) server for [StarNG](https://ramanacr.github.io/star-ng/) (`@star-ng/ui`), the library of accessible Angular controls. It gives a coding agent the setup steps, the API and the example markup of every StarNG control. It also checks the StarNG markup that the agent writes.

The server runs on your computer over stdio. It has no dependencies and needs Node.js 20.10 or later.

## Add the server to your agent

Claude Code:

```bash
claude mcp add star-ng -- npx -y @star-ng/mcp
```

Other agents (Cursor, VS Code, Windsurf, Codex and others) use a JSON entry like this one:

```json
{
  "mcpServers": {
    "star-ng": { "command": "npx", "args": ["-y", "@star-ng/mcp"] }
  }
}
```

## Tools

| Tool              | What it gives                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `get_setup`       | Install commands, styles, first use, forms, and the guide links.                                 |
| `list_components` | Every docs page with its classes and selectors. Optional filter text.                            |
| `search`          | Controls, inputs, outputs and guides that match words, for example `date range`.                 |
| `get_component`   | Import line, selector, inputs, two-way models and outputs, docs URL and example keys.            |
| `get_examples`    | The template markup of the live examples of a docs page, or of one example key.                  |
| `validate_usage`  | Unknown `star-*` elements and unknown bindings in template markup, with suggestions and imports. |

All tools only read. They never change files.

## Data

1. The package contains a snapshot of the StarNG data, made from the library source and the docs examples when the package is built.
2. At start, the server also fetches the current data from `https://ramanacr.github.io/star-ng/mcp/components.json`, once and in the background. It uses that data when the data is valid. If the fetch fails, the server uses the snapshot.
3. `get_setup` tells the agent when the `@star-ng/ui` version in the project is not the version of the data.

Environment variables:

| Variable               | Effect                                                        |
| ---------------------- | ------------------------------------------------------------- |
| `STAR_NG_MCP_OFFLINE`  | `1`: never fetch. Use only the snapshot in the package.       |
| `STAR_NG_MCP_DATA_URL` | Fetch the data from this address instead (a fork, a preview). |

## Without MCP

The docs site serves the same content as plain text for agents and tools that read `llms.txt`:

- https://ramanacr.github.io/star-ng/llms.txt: a short index with links.
- https://ramanacr.github.io/star-ng/llms-full.txt: setup, the API of every control and all example markup.

## Development

In the StarNG repository:

1. `pnpm mcp:data` makes `projects/mcp/data/mcp/components.json` (see `tools/agent-data.mjs`).
2. `pnpm test:mcp` makes the data and runs the tests in `projects/mcp/test`.
3. To try the server by hand, run `node projects/mcp/bin/star-ng-mcp.mjs` and send JSON-RPC messages, one per line.

## License

MIT
