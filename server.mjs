import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const app = express();
const PORT = Number(process.env.PORT || 3939);
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

let tasks = [
  { id: "t1", title: "Finish project README", priority: "high", status: "open", createdAt: new Date().toISOString() },
  { id: "t2", title: "Practice JavaScript", priority: "medium", status: "open", createdAt: new Date().toISOString() },
  { id: "t3", title: "Record hackathon demo", priority: "high", status: "open", createdAt: new Date().toISOString() }
];
let notes = [];
const sessions = new Map();

function addTask(title, priority = "medium") {
  const task = { id: randomUUID().slice(0, 8), title: title.trim(), priority, status: "open", createdAt: new Date().toISOString() };
  tasks.unshift(task);
  return task;
}
function completeTask(id) {
  const task = tasks.find(t => t.id === id || t.title.toLowerCase() === String(id).toLowerCase());
  if (!task) return null;
  task.status = "done";
  task.completedAt = new Date().toISOString();
  return task;
}
function createFocusPlan(minutes = 25) {
  const next = tasks.find(t => t.status === "open" && t.priority === "high")
    || tasks.find(t => t.status === "open");
  return {
    durationMinutes: minutes,
    task: next?.title || "Choose one meaningful task",
    steps: ["Silence notifications", "Work on one outcome only", "Take a short break when the timer ends"],
    message: next ? `Your next focus block is: ${next.title}` : "You're clear! Add a task to plan your next focus block."
  };
}
function summary() {
  return {
    total: tasks.length,
    open: tasks.filter(t => t.status === "open").length,
    done: tasks.filter(t => t.status === "done").length,
    highPriority: tasks.filter(t => t.status === "open" && t.priority === "high").length,
    notes: notes.length
  };
}
function toolText(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function makeMcpServer() {
  const server = new McpServer({ name: "taskpilot-ai", version: "1.0.0" });

  server.tool("list_tasks", "List TaskPilot tasks, optionally filtered by status.", {
    status: z.enum(["all", "open", "done"]).default("all")
  }, async ({ status }) => toolText(tasks.filter(t => status === "all" || t.status === status)));

  server.tool("add_task", "Create a task with a title and priority.", {
    title: z.string().min(1).max(180),
    priority: z.enum(["low", "medium", "high"]).default("medium")
  }, async ({ title, priority }) => toolText(addTask(title, priority)));

  server.tool("complete_task", "Mark a task complete by task ID or exact title.", {
    id: z.string().min(1)
  }, async ({ id }) => {
    const task = completeTask(id);
    return task ? toolText(task) : toolText({ error: "Task not found", available: tasks.map(t => ({ id: t.id, title: t.title })) });
  });

  server.tool("create_focus_plan", "Create a short focus plan based on the current task list.", {
    minutes: z.number().int().min(5).max(120).default(25)
  }, async ({ minutes }) => toolText(createFocusPlan(minutes)));

  server.tool("save_note", "Save a note in TaskPilot's in-memory workspace.", {
    title: z.string().min(1).max(100),
    content: z.string().min(1).max(2000)
  }, async ({ title, content }) => {
    const note = { id: randomUUID().slice(0, 8), title, content, createdAt: new Date().toISOString() };
    notes.unshift(note);
    return toolText(note);
  });

  server.tool("get_daily_summary", "Get counts for tasks and saved notes.", async () => toolText(summary()));
  return server;
}

app.get("/api/health", (_req, res) => res.json({
  ok: true,
  app: "TaskPilot AI",
  mcpEndpoint: `http://localhost:${PORT}/mcp`,
  transport: "MCP Streamable HTTP",
  tools: ["list_tasks", "add_task", "complete_task", "create_focus_plan", "save_note", "get_daily_summary"]
}));
app.get("/api/tasks", (_req, res) => res.json(tasks));
app.get("/api/notes", (_req, res) => res.json(notes));
app.get("/api/summary", (_req, res) => res.json(summary()));

app.post("/api/tasks", (req, res) => {
  const title = String(req.body?.title || "").trim();
  const priority = ["low", "medium", "high"].includes(req.body?.priority) ? req.body.priority : "medium";
  if (!title) return res.status(400).json({ error: "Task title is required." });
  res.status(201).json(addTask(title, priority));
});
app.patch("/api/tasks/:id/complete", (req, res) => {
  const task = completeTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found." });
  res.json(task);
});
app.post("/api/notes", (req, res) => {
  const title = String(req.body?.title || "").trim();
  const content = String(req.body?.content || "").trim();
  if (!title || !content) return res.status(400).json({ error: "Both title and content are required." });
  const note = { id: randomUUID().slice(0, 8), title, content, createdAt: new Date().toISOString() };
  notes.unshift(note);
  res.status(201).json(note);
});
app.post("/api/agent", (req, res) => {
  const prompt = String(req.body?.message || "").trim();
  if (!prompt) return res.status(400).json({ error: "Enter a message first." });
  const p = prompt.toLowerCase();
  let reply, action = null;

  const addMatch = prompt.match(/(?:add|create|remember)\s+(?:a\s+)?task\s+(?:to\s+)?(.+)/i);
  const completeMatch = prompt.match(/(?:complete|finish|done)\s+(?:the\s+)?task\s+(.+)/i);

  if (addMatch) {
    const title = addMatch[1].replace(/[.!?]+$/, "").trim();
    const priority = /urgent|important|high priority/i.test(prompt) ? "high" : "medium";
    const task = addTask(title, priority);
    action = { tool: "add_task", result: task };
    reply = `Done — I added “${task.title}” as a ${task.priority}-priority task. You can see it in your task list.`;
  } else if (completeMatch) {
    const term = completeMatch[1].replace(/[.!?]+$/, "").trim();
    const task = completeTask(term);
    action = { tool: "complete_task", result: task || { error: "I couldn't find a task with that exact title or ID." } };
    reply = task ? `Nice work! I marked “${task.title}” as complete.` : `I couldn't find “${term}”. Try the exact task title or its ID.`;
  } else if (/focus|plan|what should i do|priorit/i.test(p)) {
    const minutesMatch = p.match(/(\d{1,3})\s*(?:min|minute)/);
    const plan = createFocusPlan(minutesMatch ? Number(minutesMatch[1]) : 25);
    action = { tool: "create_focus_plan", result: plan };
    reply = `${plan.message}\n\n${plan.durationMinutes}-minute focus plan:\n1. ${plan.steps[0]}\n2. ${plan.steps[1]}\n3. ${plan.steps[2]}`;
  } else if (/summary|dashboard|how many|status/i.test(p)) {
    const s = summary();
    action = { tool: "get_daily_summary", result: s };
    reply = `Your workspace: ${s.open} open tasks, ${s.done} completed, ${s.highPriority} high-priority tasks, and ${s.notes} saved notes.`;
  } else if (/list|show|my tasks|tasks/i.test(p)) {
    const open = tasks.filter(t => t.status === "open");
    action = { tool: "list_tasks", result: open };
    reply = open.length ? `Here are your open tasks:\n${open.map((t, i) => `${i + 1}. ${t.title} (${t.priority} priority)`).join("\n")}` : "You have no open tasks. Enjoy the breathing room, or add a new task.";
  } else if (/save note|note:/i.test(p)) {
    const content = prompt.replace(/save note:?/i, "").replace(/^note:/i, "").trim();
    if (content) {
      const note = { id: randomUUID().slice(0, 8), title: content.slice(0, 40), content, createdAt: new Date().toISOString() };
      notes.unshift(note);
      action = { tool: "save_note", result: note };
      reply = "Saved that note to this workspace.";
    } else reply = "Try: “save note: idea for my next project”.";
  } else {
    reply = "I can help you manage tasks, plan a focus session, save notes, or summarize your workspace. Try “add task to revise my README”, “make me a 25-minute focus plan”, or “show my tasks”.";
  }
  res.json({ reply, action, summary: summary(), mode: "local-demo-agent" });
});

// MCP Streamable HTTP endpoint. Stateless mode creates one server/transport per request,
// while session IDs are supported for clients that initialize a stateful session.
app.post("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"];
    let transport;
    let server;

    if (sessionId && sessions.has(sessionId)) {
      ({ transport, server } = sessions.get(sessionId));
    } else if (!sessionId && isInitializeRequest(req.body)) {
      server = makeMcpServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => sessions.set(id, { transport, server })
      });
      transport.onclose = () => {
        const id = transport.sessionId;
        if (id) sessions.delete(id);
      };
      await server.connect(transport);
    } else {
      return res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: missing or invalid MCP session. Initialize with an MCP client first." },
        id: null
      });
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed." });
  }
});
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions.has(sessionId)) return res.sendStatus(400);
  const { transport } = sessions.get(sessionId);
  await transport.handleRequest(req, res);
});
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions.has(sessionId)) return res.sendStatus(400);
  const { transport } = sessions.get(sessionId);
  await transport.handleRequest(req, res);
});

app.listen(PORT, () => {
  console.log(`\n🚀 TaskPilot AI running at http://localhost:${PORT}`);
  console.log(`🔌 MCP Streamable HTTP endpoint: http://localhost:${PORT}/mcp`);
  console.log("🧰 Tools: list_tasks, add_task, complete_task, create_focus_plan, save_note, get_daily_summary\n");
});
