import type { SpeechProvider } from '#shared/utils/speech';

const SERVICE_CHUNK_LENGTH = 400;
const SILENT_SAMPLES = 400;
const SILENT_SAMPLE_RATE = 8000;

const speakingId = ref<string | null>(null);
const speechProvider = ref<SpeechProvider | null | undefined>(undefined);
let run = 0;
let player: HTMLAudioElement | null = null;
let silence: string | null = null;

function silentClip(): string {
    if (silence) {
        return silence;
    }
    const header = new DataView(new ArrayBuffer(44));
    const dataBytes = SILENT_SAMPLES * 2;
    [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']].forEach(([offset, tag]) => {
        [...(tag as string)].forEach((char, index) => header.setUint8((offset as number) + index, char.charCodeAt(0)));
    });
    header.setUint32(4, 36 + dataBytes, true);
    header.setUint32(16, 16, true);
    header.setUint16(20, 1, true);
    header.setUint16(22, 1, true);
    header.setUint32(24, SILENT_SAMPLE_RATE, true);
    header.setUint32(28, SILENT_SAMPLE_RATE * 2, true);
    header.setUint16(32, 2, true);
    header.setUint16(34, 16, true);
    header.setUint32(40, dataBytes, true);
    silence = URL.createObjectURL(new Blob([header.buffer, new ArrayBuffer(dataBytes)], { type: 'audio/wav' }));
    return silence;
}

function pickVoice(language: string): SpeechSynthesisVoice | undefined {
    const voices = speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith(language));
    return voices.find(voice => /premium|enhanced/i.test(voice.name))
        ?? voices.find(voice => voice.default)
        ?? voices[0];
}

export async function loadSpeechProvider(): Promise<SpeechProvider | null> {
    speechProvider.value = (await apiFetch<{ provider: SpeechProvider | null }>('speech/service')).provider;
    return speechProvider.value;
}

export function setSpeechProvider(provider: SpeechProvider | null): void {
    speechProvider.value = provider;
}

export function useSpeech() {
    const { locale } = useI18n();
    const { speechRate } = useAppearance();
    const supported = import.meta.client && ('speechSynthesis' in window || 'Audio' in window);

    function stop(): void {
        run++;
        speakingId.value = null;
        player?.pause();
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
        }
    }

    function finisher(current: number): () => void {
        return () => {
            if (run === current) {
                speakingId.value = null;
            }
        };
    }

    function speakWithDevice(text: string, current: number): void {
        const language = guessLanguage(text, locale.value);
        const voice = pickVoice(language);
        const chunks = speechChunks(text);
        const finish = finisher(current);
        chunks.forEach((chunk, index) => {
            const utterance = new SpeechSynthesisUtterance(chunk);
            utterance.lang = voice?.lang ?? language;
            utterance.voice = voice ?? null;
            utterance.rate = speechRate.value;
            utterance.onerror = finish;
            if (index === chunks.length - 1) {
                utterance.onend = finish;
            }
            speechSynthesis.speak(utterance);
        });
    }

    async function speakWithService(text: string, current: number, audio: HTMLAudioElement): Promise<void> {
        const chunks = speechChunks(text, SERVICE_CHUNK_LENGTH);
        const fetchChunk = (chunk: string) => apiFetch<Blob>('speech', { method: 'POST', body: { text: chunk }, responseType: 'blob' });
        let next = fetchChunk(chunks[0]!);
        for (let index = 0; index < chunks.length; index++) {
            let clip: Blob;
            try {
                clip = await next;
            }
            catch {
                if (run === current) {
                    speakWithDevice(chunks.slice(index).join(' '), current);
                }
                return;
            }
            if (run !== current) {
                return;
            }
            if (index + 1 < chunks.length) {
                next = fetchChunk(chunks[index + 1]!);
                next.catch(() => undefined);
            }
            const url = URL.createObjectURL(clip);
            audio.src = url;
            audio.playbackRate = speechRate.value;
            await new Promise<void>((resolve) => {
                audio.onended = () => resolve();
                audio.onerror = () => resolve();
                audio.onpause = () => {
                    if (run !== current) {
                        resolve();
                    }
                };
                audio.play().catch(() => resolve());
            });
            URL.revokeObjectURL(url);
            if (run !== current) {
                return;
            }
        }
        finisher(current)();
    }

    function speak(id: string, markdown: string): void {
        stop();
        const text = speakableText(markdown);
        if (!text) {
            return;
        }
        const current = run;
        speakingId.value = id;
        player ??= new Audio();
        player.preservesPitch = true;
        // Safari lets an element play later, after the fetch, only if it already played inside the click.
        player.src = silentClip();
        player.play().catch(() => undefined);
        const audio = player;
        const provider = speechProvider.value === undefined ? loadSpeechProvider().catch(() => null) : Promise.resolve(speechProvider.value);
        void provider.then((resolved) => {
            if (run !== current) {
                return;
            }
            if (resolved) {
                void speakWithService(text, current, audio);
            }
            else {
                speakWithDevice(text, current);
            }
        });
    }

    return { supported, speakingId: readonly(speakingId), speak, stop };
}
