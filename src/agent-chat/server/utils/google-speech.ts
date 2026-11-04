import { SPEECH_VOICES } from '../../shared/utils/speech';
import { serviceFailure } from './speech-failure';

type Gender = 'FEMALE' | 'MALE';

interface GoogleVoice {
    name: string;
    ssmlGender: string;
}

export interface GoogleVoiceSelection {
    languageCode: string;
    name?: string;
    ssmlGender?: Gender;
}

const GOOGLE_LOCALES: Record<string, string> = {
    en: 'en-US',
    de: 'de-DE',
    fr: 'fr-FR',
    nl: 'nl-NL',
    es: 'es-ES',
    it: 'it-IT',
};
const DEFAULT_LOCALE = 'en-US';
const CHIRP_MODEL = 'chirp3-hd';
const WAVENET_MARKER = '-Wavenet-';

const VOICE_GENDERS: Record<string, Gender> = {
    Sulafat: 'FEMALE',
    Kore: 'FEMALE',
    Aoede: 'FEMALE',
    Puck: 'MALE',
    Charon: 'MALE',
    Fenrir: 'MALE',
};

const voiceLists = new Map<string, Promise<GoogleVoice[]>>();

export function googleLocale(language: string): string {
    return GOOGLE_LOCALES[language.slice(0, 2).toLowerCase()] ?? DEFAULT_LOCALE;
}

async function fetchVoices(apiKey: string, languageCode: string): Promise<GoogleVoice[]> {
    const response = await fetch(`https://texttospeech.googleapis.com/v1/voices?languageCode=${languageCode}`, { headers: { 'x-goog-api-key': apiKey } });
    if (!response.ok) {
        throw await serviceFailure(response);
    }
    const { voices } = await response.json() as { voices?: GoogleVoice[] };
    return voices ?? [];
}

function voicesFor(apiKey: string, languageCode: string): Promise<GoogleVoice[]> {
    const known = voiceLists.get(languageCode);
    if (known) {
        return known;
    }
    const loading = fetchVoices(apiKey, languageCode);
    voiceLists.set(languageCode, loading);
    loading.catch(() => voiceLists.delete(languageCode));
    return loading;
}

function voicesOfGender(gender: Gender): string[] {
    return SPEECH_VOICES.google.filter(choice => VOICE_GENDERS[choice.id] === gender).map(choice => choice.id);
}

function genderOf(voice: string): Gender {
    return VOICE_GENDERS[voice] ?? 'FEMALE';
}

function rankAmong(voice: string, available: number): number {
    return available ? Math.max(0, voicesOfGender(genderOf(voice)).indexOf(voice)) % available : 0;
}

async function wavenetNames(apiKey: string, languageCode: string, gender: Gender): Promise<string[]> {
    return (await voicesFor(apiKey, languageCode))
        .filter(candidate => candidate.name.includes(WAVENET_MARKER) && candidate.ssmlGender === gender)
        .map(candidate => candidate.name)
        .sort();
}

async function wavenetVoice(apiKey: string, voice: string, languageCode: string): Promise<GoogleVoiceSelection> {
    const gender = genderOf(voice);
    const names = await wavenetNames(apiKey, languageCode, gender);
    if (!names.length) {
        return { languageCode, ssmlGender: gender };
    }
    return { languageCode, name: names[rankAmong(voice, names.length)] };
}

export async function googleVoice(apiKey: string, model: string, voice: string, languageCode: string): Promise<GoogleVoiceSelection> {
    if (model === CHIRP_MODEL) {
        return { languageCode, name: `${languageCode}-Chirp3-HD-${voice}` };
    }
    return wavenetVoice(apiKey, voice, languageCode);
}

export async function googleSoundsLike(apiKey: string, model: string, languageCode: string): Promise<Record<string, string>> {
    const voices = SPEECH_VOICES.google.map(choice => choice.id);
    if (model === CHIRP_MODEL) {
        return Object.fromEntries(voices.map(voice => [voice, voice]));
    }
    const available: Record<Gender, number> = {
        FEMALE: (await wavenetNames(apiKey, languageCode, 'FEMALE')).length,
        MALE: (await wavenetNames(apiKey, languageCode, 'MALE')).length,
    };
    return Object.fromEntries(voices.map((voice) => {
        const gender = genderOf(voice);
        return [voice, voicesOfGender(gender)[rankAmong(voice, available[gender])]!];
    }));
}
