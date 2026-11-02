import { Avatar, Style } from '@dicebear/core';
import { joinURL } from 'ufo';
import glyphs from '@dicebear/styles/glyphs.json';
import voxelBot from '@dicebear/styles/voxel-bot.json';

export type ParticipantKind = 'person' | 'agent';

export interface Participant {
    kind: ParticipantKind;
    name: string;
    seed?: string | null;
    image?: string | null;
}

const ANIMATION_SPEEDS = ['fastest', 'fast', 'medium', 'slow', 'slowest'];
const TRANSPARENT = '#00000000';

const STYLES: Record<ParticipantKind, { style: Style<unknown>; options: Record<string, unknown> }> = {
    person: {
        style: new Style(glyphs),
        options: {},
    },
    agent: {
        style: new Style(voxelBot),
        options: { flip: 'horizontal', animationVariant: ANIMATION_SPEEDS, backgroundColor: TRANSPARENT },
    },
};

const PRESET_PREFIX = 'preset:';
const SMILEY_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

export const PERSON_PRESET_SEEDS = SMILEY_COLORS.map(color => `${PRESET_PREFIX}smiley-${color}`);

const cache = new Map<string, string>();

export function generatedAvatarUri(kind: ParticipantKind, seed: string): string {
    const key = `${kind}:${seed}`;
    let uri = cache.get(key);
    if (!uri) {
        const { style, options } = STYLES[kind];
        uri = new Avatar(style, { ...options, seed }).toDataUri();
        cache.set(key, uri);
    }
    return uri;
}

export function avatarUri(participant: Participant): string {
    if (participant.image) {
        return participant.image.startsWith('avatars/') ? apiUrl(participant.image) : participant.image;
    }
    if (participant.seed?.startsWith(PRESET_PREFIX)) {
        return joinURL(useRuntimeConfig().app.baseURL, 'avatars', `${participant.seed.slice(PRESET_PREFIX.length)}.png`);
    }
    return generatedAvatarUri(participant.kind, participant.seed || participant.name);
}

export function randomAvatarSeeds(count: number): string[] {
    return Array.from({ length: count }, () => Math.random().toString(36).slice(2, 10));
}
