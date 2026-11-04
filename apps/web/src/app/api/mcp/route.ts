// CODEHER MCP server (Streamable HTTP, stateless). Authenticate with a staff API key
// from /equipo/claves:  Authorization: Bearer chk_...
// Claude Code:  claude mcp add --transport http codeher <origin>/api/mcp --header "Authorization: Bearer chk_..."
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ownerOf } from "@/server/mcp/store";
import { TOOLS, describeError, type ToolCtx } from "@/server/mcp/tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Per-key rate limit (per server instance; good enough for a handful of staff keys).
const hits = new Map<string, number[]>();
function limited(keyId: string): boolean {
  const max = Number(process.env.MCP_RATE_LIMIT_PER_MIN ?? 60);
  const now = Date.now();
  const recent = (hits.get(keyId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(keyId, recent);
  return recent.length > max;
}

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });

function buildServer(ctx: ToolCtx) {
  const server = new Server(
    { name: "codeher", title: "CODEHER", version: "1.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Herramientas para crear contenido educativo de CODEHER (programación para chicas de 12 a 18 años, en español de México). " +
        "Llama primero a get_authoring_guide. Todo lo que guardes queda como borrador hasta que una persona del equipo lo publique.",
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS.find((t) => t.name === req.params.name);
    if (!tool) return { isError: true, content: [{ type: "text", text: `Herramienta desconocida: ${req.params.name}` }] };
    try {
      const out = await tool.run((req.params.arguments ?? {}) as Record<string, unknown>, ctx);
      return { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: describeError(e) }] };
    }
  });
  return server;
}

async function handle(req: Request): Promise<Response> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const owner = token ? await ownerOf(token) : null;
  if (!owner) return json(401, { error: "unauthorized", message: "Usa una clave de /equipo/claves en el encabezado Authorization: Bearer chk_..." }, { "www-authenticate": 'Bearer realm="codeher"' });
  if (limited(owner.keyId)) return json(429, { error: "rate_limited" }, { "retry-after": "60" });
  const server = buildServer({ profile: owner.profile, keyId: owner.keyId });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    void server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
