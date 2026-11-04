import type { SpeechProvider } from '../../shared/utils/speech';
import type { SpeechService } from './speech-service';

const ELEVENLABS_MODEL = 'scribe_v2';
const OPENAI_MODEL = 'gpt-4o-transcribe';
const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_API_REVISION = '2026-05-20';
const GEMINI_PROMPT = 'Transcribe this recording exactly as spoken, in the language spoken. Reply with the transcript only.';
const GEMINI_MEDIA_TYPES: Record<string, string> = { 'audio/mp4': 'audio/m4a', 'audio/x-m4a': 'audio/m4a' };

export interface Recording {
    data: Buffer;
    mediaType: string;
}

function baseMediaType(mediaType: string): string {
    return mediaType.split(';')[0]!.trim().toLowerCase();
}

function outputText(response: Record<string, unknown>): string | null {
    if (typeof response.output_text === 'string') {
        return response.output_text;
    }
    const texts: string[] = [];
    const collect = (value: unknown): void => {
        if (Array.isArray(value)) {
            value.forEach(collect);
        }
        else if (value && typeof value === 'object') {
            const record = value as Record<string, unknown>;
            if (record.type === 'text' && typeof record.text === 'string') {
                texts.push(record.text);
            }
            Object.entries(record).filter(([key]) => key !== 'input').forEach(([, child]) => collect(child));
        }
    };
    collect(response.steps ?? response.outputs ?? response);
    return texts.at(-1) ?? null;
}

async function transcribeWithElevenLabs(apiKey: string, recording: Recording): Promise<string> {
    const form = new FormData();
    form.append('model_id', ELEVENLABS_MODEL);
    form.append('file', new Blob([new Uint8Array(recording.data)], { type: baseMediaType(recording.mediaType) }), 'recording');
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form });
    if (!response.ok) {
        throw await serviceFailure(response);
    }
    const { text } = await response.json() as { text?: unknown };
    return typeof text === 'string' ? text : '';
}

async function transcribeWithGemini(apiKey: string, recording: Recording): Promise<string> {
    const mediaType = baseMediaType(recording.mediaType);
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json', 'api-revision': GEMINI_API_REVISION },
        body: JSON.stringify({
            model: GEMINI_MODEL,
            input: [
                { type: 'text', text: GEMINI_PROMPT },
                { type: 'audio', data: recording.data.toString('base64'), mime_type: GEMINI_MEDIA_TYPES[mediaType] ?? mediaType },
            ],
        }),
    });
    if (!response.ok) {
        throw await serviceFailure(response);
    }
    const text = outputText(await response.json() as Record<string, unknown>);
    if (text === null) {
        throw new SpeechServiceError(false);
    }
    return text;
}

async function transcribeWithOpenAI(apiKey: string, recording: Recording): Promise<string> {
    const form = new FormData();
    form.append('model', OPENAI_MODEL);
    form.append('file', new Blob([new Uint8Array(recording.data)], { type: baseMediaType(recording.mediaType) }), `recording.${baseMediaType(recording.mediaType).split('/')[1] ?? 'webm'}`);
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form });
    if (!response.ok) {
        throw await serviceFailure(response);
    }
    const { text } = await response.json() as { text?: unknown };
    return typeof text === 'string' ? text : '';
}

const TRANSCRIBERS: Record<SpeechProvider, (apiKey: string, recording: Recording) => Promise<string>> = {
    gemini: transcribeWithGemini,
    elevenlabs: transcribeWithElevenLabs,
    openai: transcribeWithOpenAI,
};

export async function transcribeSpeech(service: SpeechService, recording: Recording): Promise<string> {
    return (await TRANSCRIBERS[service.provider](service.apiKey, recording)).trim();
}
