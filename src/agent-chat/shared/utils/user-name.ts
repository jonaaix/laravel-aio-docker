export const USER_NAME_MAX_LENGTH = 60;

export function normalizeUserName(value: unknown): string | null {
    const name = typeof value === 'string' ? value.trim() : '';
    return name && name.length <= USER_NAME_MAX_LENGTH ? name : null;
}

interface NamedPerson {
    id: string;
    name: string;
}

function nameParts(name: string): string[] {
    return name.trim().split(/\s+/).filter(Boolean);
}

function firstName(name: string): string {
    return nameParts(name)[0] ?? name;
}

function firstNameWithInitial(name: string): string {
    const parts = nameParts(name);
    const lastName = parts.length > 1 ? parts.at(-1)! : '';
    return lastName ? `${parts[0]} ${lastName.charAt(0).toUpperCase()}.` : name.trim();
}

function countBy(values: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const value of values) {
        const key = value.toLocaleLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

export function chatNames(people: NamedPerson[]): Record<string, string> {
    const firstNames = countBy(people.map(person => firstName(person.name)));
    const withInitials = countBy(people.map(person => firstNameWithInitial(person.name)));
    return Object.fromEntries(people.map((person) => {
        if (firstNames.get(firstName(person.name).toLocaleLowerCase()) === 1) {
            return [person.id, firstName(person.name)];
        }
        const initialled = firstNameWithInitial(person.name);
        return [person.id, withInitials.get(initialled.toLocaleLowerCase()) === 1 ? initialled : person.name.trim()];
    }));
}
