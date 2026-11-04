import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SpeechProvider } from '../../shared/utils/speech';
import type { SpeechService } from './speech-service';

export interface SynthesizedAudio {
    data: Buffer;
    mediaType: string;
}

interface VoiceSetup {
    model: string;
    voice: string;
    mediaType: string;
    extension: string;
}

const VOICES: Record<SpeechProvider, VoiceSetup> = {
    gemini: { model: 'gemini-3.8-flash-lite-tts', voice: 'Sulafat', mediaType: 'audio/wav', extension: 'wav' },
    elevenlabs: { model: 'eleven_flash_v2_5', voice: 'JBFqnCBsd6RMkjVDRZzb', mediaType: 'audio/mpeg', extension: 'mp3' },
};

const REJECTED_KEY = new Set([401, 403]);
const GEMINI_INVALID_KEY = 'API_KEY_INVALID';

export class SpeechServiceError extends Error {
    constructor(readonly keyRejected: boolean) {
        super(keyRejected ? 'The voice service did not accept the key' : 'The voice service did not answer');
    }
}

export async function serviceFailure(response: Response): Promise<SpeechServiceError> {
    const body = await response.text().catch(() => '');
    return new SpeechServiceError(REJECTED_KEY.has(response.status) || body.includes(GEMINI_INVALID_KEY));
}

function findAudioData(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value as Record<string, unknown>;
    if (record.type === 'audio' && typeof record.data === 'string') {
        return record.data;
    }
    for (const child of Object.values(record)) {
        const found = findAudioData(child);
        if (found) {
            return found;
        }
    }
    return null;
}

async function synthesizeWithGemini(apiKey: string, text: string): Promise<Buffer> {
    const setup = VOICES.gemini;
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
            model: setup.model,
            input: [{ type: 'user_input', content: [{ type: 'text', text }] }],
            response_format: { type: 'audio', mime_type: setup.mediaType },
            generation_config: { speech_config: [{ voice: setup.voice }] },
        }),
    });
    if (!response.ok) {
        throw await serviceFailure(response);
    }
    const audio = findAudioData(await response.json());
    if (!audio) {
        throw new SpeechServiceError(false);
    }
    return Buffer.from(audio, 'base64');
}

async function synthesizeWithElevenLabs(apiKey: string, text: string): Promise<Buffer> {
    const setup = VOICES.elevenlabs;
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${setup.voice}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ text, model_id: setup.model }),
    });
    if (!response.ok) {
        throw await serviceFailure(response);
    }
    return Buffer.from(await response.arrayBuffer());
}

export async function synthesizeSpeech(service: SpeechService, text: string): Promise<SynthesizedAudio> {
    const setup = VOICES[service.provider];
    const data = service.provider === 'gemini'
        ? await synthesizeWithGemini(service.apiKey, text)
        : await synthesizeWithElevenLabs(service.apiKey, text);
    return { data, mediaType: setup.mediaType };
}

function cachePath(provider: SpeechProvider, text: string): string {
    const setup = VOICES[provider];
    const dir = join(resolveDataDir(), 'speech');
    mkdirSync(dir, { recursive: true });
    const name = createHash('sha256').update(`${provider}|${setup.model}|${setup.voice}|${text}`).digest('hex');
    return join(dir, `${name}.${setup.extension}`);
}

export async function cachedSpeech(service: SpeechService, text: string): Promise<SynthesizedAudio> {
    const path = cachePath(service.provider, text);
    if (existsSync(path)) {
        return { data: readFileSync(path), mediaType: VOICES[service.provider].mediaType };
    }
    const audio = await synthesizeSpeech(service, text);
    writeFileSync(path, audio.data);
    return audio;
}
