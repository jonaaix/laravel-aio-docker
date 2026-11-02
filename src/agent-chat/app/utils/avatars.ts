import { Avatar, Style } from '@dicebear/core';
import shadows from '@dicebear/styles/shadows.json';
import voxelBot from '@dicebear/styles/voxel-bot.json';

export type ParticipantKind = 'person' | 'agent';

export interface Participant {
    kind: ParticipantKind;
    name: string;
}

const STYLES: Record<ParticipantKind, Style<unknown>> = {
    person: new Style(shadows),
    agent: new Style(voxelBot),
};

const cache = new Map<string, string>();

export function avatarUri(participant: Participant): string {
    const key = `${participant.kind}:${participant.name}`;
    let uri = cache.get(key);
    if (!uri) {
        uri = new Avatar(STYLES[participant.kind], { seed: participant.name, flip: participant.kind === 'agent' ? 'horizontal' : 'none' }).toDataUri();
        cache.set(key, uri);
    }
    return uri;
}
