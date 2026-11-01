const PROTOCOL_VERSION = '2025-06-18';

interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: string | number;
    method: string;
    params?: Record<string, unknown>;
}

interface ToolResult {
    content: { type: 'text'; text: string }[];
    isError?: boolean;
}

const TOOLS = [
    {
        name: 'send_file',
        description: 'Show a file or image to the user in the chat: screenshots, exports, reports, generated files. '
            + 'The user reads the chat in a browser and cannot see files on disk or terminal output, so send anything they should look at. Images appear inline, other files as a download.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Absolute path, or a path relative to the working directory.' },
            },
            required: ['path'],
        },
    },
];

function textResult(text: string, isError = false): ToolResult {
    return { content: [{ type: 'text', text }], ...(isError ? { isError } : {}) };
}

function callTool(conversationId: string, name: unknown, args: Record<string, unknown>): ToolResult {
    if (name !== 'send_file') {
        return textResult(`Unknown tool: ${String(name)}`, true);
    }
    if (typeof args.path !== 'string' || !args.path.trim()) {
        return textResult('The path is required.', true);
    }
    try {
        const filename = useConversationRuntime(conversationId).attachFile(args.path);
        return textResult(`Sent ${filename} to the chat.`);
    }
    catch (error) {
        return textResult(error instanceof Error ? error.message : String(error), true);
    }
}

function respond(conversationId: string, request: JsonRpcRequest): unknown {
    switch (request.method) {
        case 'initialize':
            return {
                protocolVersion: typeof request.params?.protocolVersion === 'string' ? request.params.protocolVersion : PROTOCOL_VERSION,
                capabilities: { tools: {} },
                serverInfo: { name: 'agent-chat', version: '1.0.0' },
            };
        case 'tools/list':
            return { tools: TOOLS };
        case 'tools/call':
            return callTool(conversationId, request.params?.name, (request.params?.arguments ?? {}) as Record<string, unknown>);
        case 'ping':
            return {};
        default:
            return undefined;
    }
}

export function handleChatMcpMessage(conversationId: string, request: JsonRpcRequest): object | null {
    if (request.id === undefined) {
        return null;
    }
    const result = respond(conversationId, request);
    return result === undefined
        ? { jsonrpc: '2.0', id: request.id, error: { code: -32601, message: `Method not found: ${request.method}` } }
        : { jsonrpc: '2.0', id: request.id, result };
}
