export const HEARTBEAT_MS = 15_000;

type Pushable = { push: (message: { event: string; data: string }) => unknown };

export function startHeartbeat(stream: Pushable, intervalMs = HEARTBEAT_MS): () => void {
    const timer = setInterval(() => {
        void Promise.resolve(stream.push({ event: 'ping', data: '1' })).catch(() => undefined);
    }, intervalMs);
    return () => clearInterval(timer);
}
