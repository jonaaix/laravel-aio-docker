import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { speechVoice, type SpeechProvider } from '../../shared/utils/speech';
import { googleLocale, googleVoice } from './google-speech';
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
    google: { mediaType: 'audio/mpeg', extension: 'mp3' },
    gemini: { mediaType: 'audio/wav', extension: 'wav' },
    elevenlabs: { mediaType: 'audio/mpeg', extension: 'mp3' },
    openai: { mediaType: 'audio/mpeg', extension: 'mp3' },
};

interface SpeechRequest {
    apiKey: string;
    model: string;
    voice: string;
    text: string;
    language: string;
}

const LANGUAGE_BOUND = new Set<SpeechProvider>(['google']);
const LOGGED_BODY_LENGTH = 600;

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

async function synthesizeWithGoogle({ apiKey, model, voice, text, language }: SpeechRequest): Promise<Buffer> {
    const languageCode = googleLocale(language);
    const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
            input: { text },
            voice: await googleVoice(apiKey, model, voice, languageCode),
            audioConfig: { audioEncoding: 'MP3' },
        }),
    });
    if (!response.ok) {
        throw await serviceFailure(response);
    }
    const { audioContent } = await response.json() as { audioContent?: unknown };
    if (typeof audioContent !== 'string') {
        throw new SpeechServiceError('unavailable');
    }
    return Buffer.from(audioContent, 'base64');
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
    google: synthesizeWithGoogle,
    gemini: synthesizeWithGemini,
    elevenlabs: synthesizeWithElevenLabs,
    openai: synthesizeWithOpenAI,
};

export async function synthesizeSpeech(service: SpeechService, text: string, voice: string, language: string): Promise<SynthesizedAudio> {
    const data = await SYNTHESIZERS[service.provider]({ apiKey: service.apiKey, model: service.model, voice: speechVoice(service.provider, voice).id, text, language });
    return { data, mediaType: FORMATS[service.provider].mediaType };
}

function cachePath(service: SpeechService, voice: string, text: string, language: string): string {
    const dir = join(resolveDataDir(), 'speech');
    mkdirSync(dir, { recursive: true });
    const parts = [service.provider, service.model, speechVoice(service.provider, voice).id, text];
    if (LANGUAGE_BOUND.has(service.provider)) {
        parts.splice(3, 0, googleLocale(language));
    }
    const name = createHash('sha256').update(parts.join('|')).digest('hex');
    return join(dir, `${name}.${FORMATS[service.provider].extension}`);
}

export async function cachedSpeech(service: SpeechService, text: string, voice: string, language: string): Promise<SynthesizedAudio> {
    const path = cachePath(service, voice, text, language);
    if (existsSync(path)) {
        return { data: readFileSync(path), mediaType: FORMATS[service.provider].mediaType };
    }
    const audio = await synthesizeSpeech(service, text, voice, language);
    writeFileSync(path, audio.data);
    return audio;
}
