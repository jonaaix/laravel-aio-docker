import { Avatar, Style } from '@dicebear/core';
import pixelArt from '@dicebear/styles/pixel-art.json';
import pixelbot from '@dicebear/styles/pixelbot.json';

export type ParticipantKind = 'person' | 'agent';

export interface Participant {
    kind: ParticipantKind;
    name: string;
}

const HAPPY_MOUTHS = Array.from({ length: 13 }, (_, index) => `happy${String(index + 1).padStart(2, '0')}`);

const STYLES: Record<ParticipantKind, { style: Style<unknown>; options: Record<string, unknown> }> = {
    person: { style: new Style(pixelArt), options: { mouthVariant: HAPPY_MOUTHS } },
    agent: { style: new Style(pixelbot), options: { flip: 'horizontal' } },
};

const cache = new Map<string, string>();

export function avatarUri(participant: Participant): string {
    const key = `${participant.kind}:${participant.name}`;
    let uri = cache.get(key);
    if (!uri) {
        const { style, options } = STYLES[participant.kind];
        uri = new Avatar(style, { ...options, seed: participant.name }).toDataUri();
        cache.set(key, uri);
    }
    return uri;
}
