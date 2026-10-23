# TaskPilot AI ✦

**A local-first productivity copilot with a self-hosted MCP Streamable HTTP server.**

TaskPilot gives you one workspace for task management, focus planning, and quick notes. It includes a responsive dashboard and a small local agent interface that maps natural-language requests to workspace actions. A self-hosted MCP endpoint exposes the same core capabilities as tools.

> **Honest demo note:** The included chat uses deterministic local intent matching, not a hosted LLM. It does not call Amazon Bedrock by default. The MCP server is implemented with the official Model Context Protocol SDK. This keeps the project runnable without AWS credentials; describe it as a local agent demo rather than claiming generative AI is connected.

## 🚀 Run the Live Demo Locally

The application currently runs locally on your computer.

**Local URL:** http://localhost:3939

> Note: This URL is accessible only on the computer running the server. To try the application, clone the repository and follow the setup instructions below.

### Run Locally
```bash
npm install
node server.mjs
```

Then open http://localhost:3939 in your browser.


## Features

- Responsive dark dashboard with overview, task list, notes, and assistant views.
- Add tasks, set priorities, mark tasks complete, and view a workspace summary.
- Ask the local assistant to add/complete tasks, show tasks, plan a focus session, save a note, or summarize progress.
- Self-hosted MCP endpoint at `http://localhost:3939/mcp` using Streamable HTTP.
- Six MCP tools: `list_tasks`, `add_task`, `complete_task`, `create_focus_plan`, `save_note`, and `get_daily_summary`.
- No API key required for the local demo.

## Requirements

- Node.js 20.11 or newer
- npm

## Run locally

1. Download or clone this repository.
2. Open a terminal in the project folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open [http://localhost:3939](http://localhost:3939).

The MCP endpoint is `http://localhost:3939/mcp`. Health details and the available tool names are available at `http://localhost:3939/api/health`.

To change the port on Windows PowerShell:

```powershell
$env:PORT=4040
npm start
```

Then open `http://localhost:4040`.

## Try these prompts

- `Add task to prepare the project demo, high priority`
- `Show my tasks`
- `Make me a 25-minute focus plan`
- `Give me a workspace summary`
- `Save note: explore Bedrock integration next`

The initial task list and notes are demo data. Data is kept in server memory and resets when the process restarts; this is not durable database storage.

## MCP server

The server registers these tools through `@modelcontextprotocol/sdk` and exposes them over Streamable HTTP:

| Tool | Purpose |
| --- | --- |
| `list_tasks` | List all, open, or completed tasks |
| `add_task` | Add a task with a priority |
| `complete_task` | Complete a task by ID or exact title |
| `create_focus_plan` | Create a focus block using open tasks |
| `save_note` | Save a note to the current process memory |
| `get_daily_summary` | Return task and note counts |

The `/mcp` route handles MCP initialization and subsequent session requests. To validate the endpoint, use a compatible MCP client configured for Streamable HTTP with the URL `http://localhost:3939/mcp`.

## Architecture

```text
Browser UI (HTML/CSS/vanilla JS)
       |
       | JSON API
       v
Node.js + Express ----------------------> In-memory tasks / notes
       |
       | MCP Streamable HTTP endpoint
       v
Official MCP SDK tools (/mcp)
```

The current web assistant calls the local `/api/agent` route, which runs predictable local intent matching and workspace actions. The MCP tools are separately exposed for compatible MCP clients. A future version could connect an LLM/Bedrock orchestration layer to these tools.

## Security and limitations

- This demo is intended to run locally. Do not expose it publicly without adding authentication, rate limiting, input validation appropriate to deployment, and secure session handling.
- Task and note data is in memory and resets on restart.
- No Amazon Bedrock credentials are needed or used in the default build.
- Google Fonts are loaded from an external CDN; if offline, the page falls back to system fonts.

## Hackathon submission checklist

- [ ] Run the project locally and test the features.
- [ ] Test `/mcp` with a compatible MCP client and verify tools can be listed/called.
- [ ] Record a public demo video under 3 minutes showing the app functioning.
- [ ] Include the public GitHub repository and a visible open-source license.
- [ ] Complete the hackathon product feedback fields honestly.
- [ ] If this builds on a pre-existing repository, explain exactly what was changed during the hackathon.

## License

MIT. See [`LICENSE`](LICENSE).

## Attribution

Built as an original TaskPilot AI demo. The UI and local workflow are included in this repository; do not claim third-party services or AI models are connected unless you add and test that integration.
