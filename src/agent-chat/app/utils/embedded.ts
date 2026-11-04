export function isEmbedded(): boolean {
    return import.meta.client && window.top !== window.self;
}
