export const HEARTBEAT_MS = 15_000;

type Pushable = { push: (message: { event: string; data: string }) => unknown };

export function startHeartbeat(stream: Pushable, intervalMs = HEARTBEAT_MS): () => void {
    const timer = setInterval(() => {
        void stream.push({ event: 'ping', data: '1' });
    }, intervalMs);
    return () => clearInterval(timer);
}
