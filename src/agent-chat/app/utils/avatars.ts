import { Avatar, Style } from '@dicebear/core';
import critters from '@dicebear/styles/critters.json';
import voxelBot from '@dicebear/styles/voxel-bot.json';

export type ParticipantKind = 'person' | 'agent';

export interface Participant {
    kind: ParticipantKind;
    name: string;
    seed?: string | null;
    image?: string | null;
}

const FRIENDLY_MOUTHS = ['smile', 'tinySmile', 'grin', 'laugh', 'teeth', 'catMouth', 'tongue', 'blep'];
const FRIENDLY_EYES = ['round', 'dots', 'bigPupils', 'happy', 'wink', 'wide', 'closedLine', 'sleepy'];
const ANIMATION_SPEEDS = ['fastest', 'fast', 'medium', 'slow', 'slowest'];
const TRANSPARENT = '#00000000';

const STYLES: Record<ParticipantKind, { style: Style<unknown>; options: Record<string, unknown> }> = {
    person: {
        style: new Style(critters),
        options: { flip: 'horizontal', mouthVariant: FRIENDLY_MOUTHS, eyesVariant: FRIENDLY_EYES },
    },
    agent: {
        style: new Style(voxelBot),
        options: { flip: 'horizontal', animationVariant: ANIMATION_SPEEDS, backgroundColor: TRANSPARENT },
    },
};

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
    return generatedAvatarUri(participant.kind, participant.seed || participant.name);
}

export function randomAvatarSeeds(count: number): string[] {
    return Array.from({ length: count }, () => Math.random().toString(36).slice(2, 10));
}
