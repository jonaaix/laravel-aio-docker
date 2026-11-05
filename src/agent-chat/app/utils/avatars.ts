import { Avatar, Style } from '@dicebear/core';
import { joinURL } from 'ufo';
import dylan from '@dicebear/styles/dylan.json';
import glyphs from '@dicebear/styles/glyphs.json';
import notionists from '@dicebear/styles/notionists.json';
import shapeGrid from '@dicebear/styles/shape-grid.json';
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
const VIVID_BODIES = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'];

const STYLES: Record<ParticipantKind, { style: Style<unknown>; options: Record<string, unknown> }> = {
    person: {
        style: new Style(glyphs),
        options: {},
    },
    agent: {
        style: new Style(voxelBot),
        options: { flip: 'horizontal', animationVariant: ANIMATION_SPEEDS, backgroundColor: TRANSPARENT, bodyColor: VIVID_BODIES },
    },
};

const BOLD_POP_BACKGROUNDS = ['#ff5d8f', '#ffb703', '#43aa8b', '#4d96ff', '#b57bff'];

const PERSON_STYLES: Record<string, { style: Style<unknown>; options: Record<string, unknown> }> = {
    'notionists:': { style: new Style(notionists), options: { flip: 'horizontal', backgroundColor: BOLD_POP_BACKGROUNDS } },
    'dylan:': { style: new Style(dylan), options: { backgroundColor: BOLD_POP_BACKGROUNDS } },
};

export const PERSON_STYLE_PREFIXES = ['', ...Object.keys(PERSON_STYLES)];

const PRESET_PREFIX = 'preset:';
const SMILEY_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

const PRESET_DESIGNS = ['smiley', 'wow'];

export const AGENT_PRESET_ROWS = PRESET_DESIGNS.map(design => SMILEY_COLORS.map(color => `${PRESET_PREFIX}${design}-${color}`));

const cache = new Map<string, string>();
const CHAT_SHAPE_SCALE = 0.75;
// Shape Grid sizes each shape at random, which reads as sloppiness when a chat picture holds a single shape.
const chatStyle = new Style({ ...shapeGrid, components: { ...shapeGrid.components, shape: { ...shapeGrid.components.shape, scale: { min: CHAT_SHAPE_SCALE, max: CHAT_SHAPE_SCALE } } } });

export function chatAvatarUri(conversationId: string): string {
    const key = `chat:${conversationId}`;
    let uri = cache.get(key);
    if (!uri) {
        uri = new Avatar(chatStyle, { seed: conversationId, rowsVariant: ['rows01'] }).toDataUri();
        cache.set(key, uri);
    }
    return uri;
}

export function generatedAvatarUri(kind: ParticipantKind, seed: string): string {
    const key = `${kind}:${seed}`;
    let uri = cache.get(key);
    if (!uri) {
        const prefix = kind === 'person' ? Object.keys(PERSON_STYLES).find(candidate => seed.startsWith(candidate)) : undefined;
        uri = prefix
            ? new Avatar(PERSON_STYLES[prefix]!.style, { ...PERSON_STYLES[prefix]!.options, seed: seed.slice(prefix.length) }).toDataUri()
            : new Avatar(STYLES[kind].style, { ...STYLES[kind].options, seed }).toDataUri();
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

export function isVoxelBot(participant: Participant): boolean {
    return participant.kind === 'agent' && !participant.image && !participant.seed?.startsWith(PRESET_PREFIX);
}

export function randomAvatarSeeds(count: number): string[] {
    return Array.from({ length: count }, () => Math.random().toString(36).slice(2, 10));
}
