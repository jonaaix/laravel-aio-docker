import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { speechVoice, type SpeechProvider } from '../../shared/utils/speech';
import type { SpeechService } from './speech-service';

export interface SynthesizedAudio {
    data: Buffer;
    mediaType: string;
}

interface AudioFormat {
    mediaType: string;
    extension: string;
}

const FORMATS: Record<SpeechProvider, AudioFormat> = {
    gemini: { mediaType: 'audio/wav', extension: 'wav' },
    elevenlabs: { mediaType: 'audio/mpeg', extension: 'mp3' },
    openai: { mediaType: 'audio/mpeg', extension: 'mp3' },
};

interface SpeechRequest {
    apiKey: string;
    model: string;
    voice: string;
    text: string;
}

const REJECTED_KEY = new Set([401, 403]);
const GEMINI_INVALID_KEY = 'API_KEY_INVALID';

export type SpeechFailure = 'key' | 'credit' | 'unavailable';

const FAILURE_STATUS: Record<SpeechFailure, number> = { key: 422, credit: 402, unavailable: 502 };
const FAILURE_MESSAGE: Record<SpeechFailure, string> = {
    key: 'The voice service did not accept the key',
    credit: 'The voice service has no credit left',
    unavailable: 'The voice service did not answer',
};
const NO_CREDIT_STATUS = 402;
const NO_CREDIT_MARKERS = ['insufficient_quota', 'quota_exceeded', 'credits are depleted'];

export class SpeechServiceError extends Error {
    constructor(readonly reason: SpeechFailure) {
        super(FAILURE_MESSAGE[reason]);
    }
}

export function speechServiceHttpError(failure: SpeechServiceError) {
    return createError({ statusCode: FAILURE_STATUS[failure.reason], statusMessage: failure.message });
}

const LOGGED_BODY_LENGTH = 600;

export async function serviceFailure(response: Response): Promise<SpeechServiceError> {
    const body = await response.text().catch(() => '');
    console.warn(`[speech] ${response.url} answered ${response.status}: ${body.slice(0, LOGGED_BODY_LENGTH)}`);
    if (REJECTED_KEY.has(response.status) || body.includes(GEMINI_INVALID_KEY)) {
        return new SpeechServiceError('key');
    }
    const noCredit = response.status === NO_CREDIT_STATUS || NO_CREDIT_MARKERS.some(marker => body.includes(marker));
    return new SpeechServiceError(noCredit ? 'credit' : 'unavailable');
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

async function synthesizeWithGemini({ apiKey, model, voice, text }: SpeechRequest): Promise<Buffer> {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
            model,
            input: [{ type: 'user_input', content: [{ type: 'text', text }] }],
            response_format: { type: 'audio', mime_type: FORMATS.gemini.mediaType },
            generation_config: { speech_config: [{ voice }] },
        }),
    });
    if (!response.ok) {
        throw await serviceFailure(response);
    }
    const answer = await response.json();
    const audio = findAudioData(answer);
    if (!audio) {
        console.warn(`[speech] Gemini answered without audio: ${JSON.stringify(answer).slice(0, LOGGED_BODY_LENGTH)}`);
        throw new SpeechServiceError('unavailable');
    }
    return Buffer.from(audio, 'base64');
}

async function synthesizeWithElevenLabs({ apiKey, model, voice, text }: SpeechRequest): Promise<Buffer> {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ text, model_id: model }),
    });
    if (!response.ok) {
        throw await serviceFailure(response);
    }
    return Buffer.from(await response.arrayBuffer());
}

async function synthesizeWithOpenAI({ apiKey, model, voice, text }: SpeechRequest): Promise<Buffer> {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, voice, input: text, response_format: FORMATS.openai.extension }),
    });
    if (!response.ok) {
        throw await serviceFailure(response);
    }
    return Buffer.from(await response.arrayBuffer());
}

const SYNTHESIZERS: Record<SpeechProvider, (request: SpeechRequest) => Promise<Buffer>> = {
    gemini: synthesizeWithGemini,
    elevenlabs: synthesizeWithElevenLabs,
    openai: synthesizeWithOpenAI,
};

export async function synthesizeSpeech(service: SpeechService, text: string, voice: string): Promise<SynthesizedAudio> {
    const data = await SYNTHESIZERS[service.provider]({ apiKey: service.apiKey, model: service.model, voice: speechVoice(service.provider, voice).id, text });
    return { data, mediaType: FORMATS[service.provider].mediaType };
}

function cachePath(service: SpeechService, voice: string, text: string): string {
    const dir = join(resolveDataDir(), 'speech');
    mkdirSync(dir, { recursive: true });
    const name = createHash('sha256').update(`${service.provider}|${service.model}|${speechVoice(service.provider, voice).id}|${text}`).digest('hex');
    return join(dir, `${name}.${FORMATS[service.provider].extension}`);
}

export async function cachedSpeech(service: SpeechService, text: string, voice: string): Promise<SynthesizedAudio> {
    const path = cachePath(service, voice, text);
    if (existsSync(path)) {
        return { data: readFileSync(path), mediaType: FORMATS[service.provider].mediaType };
    }
    const audio = await synthesizeSpeech(service, text, voice);
    writeFileSync(path, audio.data);
    return audio;
}
