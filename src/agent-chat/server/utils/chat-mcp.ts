import { UI_BLOCK_PART } from '../../shared/types/ui-block';

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
                caption: { type: 'string', description: 'Optional short caption shown under the image, such as "Start page, desktop".' },
            },
            required: ['path'],
        },
    },
    ...UI_BLOCK_TOOLS,
];

function textResult(text: string, isError = false): ToolResult {
    return { content: [{ type: 'text', text }], ...(isError ? { isError } : {}) };
}

function sendFile(conversationId: string, args: Record<string, unknown>): ToolResult {
    if (typeof args.path !== 'string' || !args.path.trim()) {
        return textResult('The path is required.', true);
    }
    const caption = typeof args.caption === 'string' && args.caption.trim() ? args.caption.trim() : undefined;
    const filename = useConversationRuntime(conversationId).attachFile(args.path, caption);
    return textResult(`Sent ${filename} to the chat.`);
}

function showUiBlock(conversationId: string, tool: string, args: Record<string, unknown>): ToolResult {
    useConversationRuntime(conversationId).attachPart(workingDir => ({
        type: UI_BLOCK_PART,
        data: uiBlockFor(tool, args, (path) => {
            const stored = storeConversationFile(conversationId, workingDir, path);
            return { url: pageUrl(conversationId, stored), fileUrl: fileUrl(conversationId, stored), filename: stored.filename };
        }),
    }));
    return textResult('Shown in the chat.');
}

function callTool(conversationId: string, name: unknown, args: Record<string, unknown>): ToolResult {
    try {
        if (name === 'send_file') {
            return sendFile(conversationId, args);
        }
        if (typeof name === 'string' && UI_BLOCK_TOOL_NAMES.has(name)) {
            return showUiBlock(conversationId, name, args);
        }
        return textResult(`Unknown tool: ${String(name)}`, true);
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
