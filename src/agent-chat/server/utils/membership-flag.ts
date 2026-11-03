export function isMembershipFlag(value: unknown): value is boolean {
    return typeof value === 'boolean';
}
