import type { SpeechProvider } from '#shared/utils/speech';

const SERVICE_CHUNK_LENGTH = 400;
const SERVICE_FIRST_CHUNK_LENGTH = 120;
const SILENT_SAMPLES = 400;
const SILENT_SAMPLE_RATE = 8000;
const SKIP_SECONDS = 10;
const DEVICE_RESTART_GRACE_MS = 2000;

type SpeechMode = 'service' | 'device';

const speakingId = ref<string | null>(null);
const preparingId = ref<string | null>(null);
const sourceConversationId = ref<string | null>(null);
const sourceLabel = ref('');
const paused = ref(false);
const progress = ref(0);
const currentChunk = ref(0);
const chunkTexts = shallowRef<string[]>([]);
const speechProvider = ref<SpeechProvider | null | undefined>(undefined);
let run = 0;
let player: HTMLAudioElement | null = null;
let mode: SpeechMode = 'service';
let chunks: string[] = [];
let offsets: number[] = [];
let totalLength = 1;
let chunkIndex = 0;
let language = 'en';
let rate = 1;
let deviceChunkStartedAt = 0;
let clips = new Map<number, Promise<Blob>>();
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

export function useSpeechProvider(): Readonly<Ref<SpeechProvider | null | undefined>> {
    if (import.meta.client && speechProvider.value === undefined) {
        void loadSpeechProvider().catch(() => undefined);
    }
    return readonly(speechProvider);
}

export function setSpeechProvider(provider: SpeechProvider | null): void {
    speechProvider.value = provider;
}

function setProgress(index: number, fraction: number): void {
    progress.value = Math.min(1, ((offsets[index] ?? 0) + (chunks[index]?.length ?? 0) * fraction) / totalLength);
}

function finish(current: number): void {
    if (run !== current) {
        return;
    }
    speakingId.value = null;
    preparingId.value = null;
    sourceConversationId.value = null;
    paused.value = false;
    progress.value = 0;
    stopSpeechLevel();
}

function halt(): void {
    run++;
    player?.pause();
    if (import.meta.client && 'speechSynthesis' in window) {
        speechSynthesis.cancel();
    }
}

function speakWithDevice(from: number, current: number): void {
    mode = 'device';
    const voice = pickVoice(language);
    chunks.slice(from).forEach((chunk, offset) => {
        const index = from + offset;
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = voice?.lang ?? language;
        utterance.voice = voice ?? null;
        utterance.rate = rate;
        utterance.onstart = () => {
            if (run !== current) {
                return;
            }
            preparingId.value = null;
            chunkIndex = index;
            currentChunk.value = index;
            deviceChunkStartedAt = Date.now();
            setProgress(index, 0);
        };
        utterance.onboundary = (event) => {
            if (run === current) {
                pulseSpokenWord();
                setProgress(index, event.charIndex / Math.max(1, chunk.length));
            }
        };
        utterance.onerror = () => finish(current);
        if (index === chunks.length - 1) {
            utterance.onend = () => finish(current);
        }
        speechSynthesis.speak(utterance);
    });
}

function clip(index: number): Promise<Blob> {
    const known = clips.get(index);
    if (known) {
        return known;
    }
    const loading = apiFetch<Blob>('speech', { method: 'POST', body: { text: chunks[index], language }, responseType: 'blob' });
    loading.catch(() => clips.delete(index));
    clips.set(index, loading);
    return loading;
}

function waitForMetadata(audio: HTMLAudioElement): Promise<void> {
    return new Promise((resolve) => {
        if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            resolve();
            return;
        }
        audio.onloadedmetadata = () => resolve();
    });
}

async function speakWithService(from: number, startAt: number, current: number, audio: HTMLAudioElement): Promise<void> {
    mode = 'service';
    for (let index = from; index < chunks.length; index++) {
        let blob: Blob;
        try {
            blob = await clip(index);
        }
        catch {
            if (run === current) {
                speakWithDevice(index, current);
            }
            return;
        }
        if (run !== current) {
            return;
        }
        if (index + 1 < chunks.length) {
            clip(index + 1).catch(() => undefined);
        }
        chunkIndex = index;
        currentChunk.value = index;
        const url = URL.createObjectURL(blob);
        audio.src = url;
        audio.playbackRate = rate;
        if (startAt !== 0) {
            await waitForMetadata(audio);
            audio.currentTime = startAt > 0 ? startAt : Math.max(0, audio.duration + startAt);
            startAt = 0;
        }
        setProgress(index, 0);
        await new Promise<void>((resolve) => {
            audio.onplaying = () => {
                if (run === current) {
                    preparingId.value = null;
                }
            };
            audio.ontimeupdate = () => {
                if (run === current && audio.duration) {
                    setProgress(index, audio.currentTime / audio.duration);
                }
            };
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.onpause = () => {
                if (run !== current) {
                    resolve();
                }
            };
            if (!paused.value) {
                audio.play().catch(() => resolve());
            }
        });
        URL.revokeObjectURL(url);
        if (run !== current) {
            return;
        }
    }
    finish(current);
}

function playFrom(index: number, startAt = 0): void {
    halt();
    const current = run;
    paused.value = false;
    if (mode === 'service' && player) {
        void speakWithService(index, startAt, current, player);
    }
    else {
        speakWithDevice(index, current);
    }
}

export function followSpeechRate(): void {
    const { speechRate } = useAppearance();
    watch(speechRate, (value) => {
        rate = value;
        if (!speakingId.value) {
            return;
        }
        if (mode === 'service' && player) {
            player.playbackRate = value;
        }
        else if (!paused.value) {
            playFrom(chunkIndex);
        }
    }, { immediate: true });
}

export function useSpeechPlayer() {
    function pause(): void {
        paused.value = true;
        if (mode === 'service') {
            player?.pause();
        }
        else {
            speechSynthesis.pause();
        }
    }

    function resume(): void {
        paused.value = false;
        if (mode === 'service') {
            player?.play().catch(() => undefined);
        }
        else {
            speechSynthesis.resume();
        }
    }

    function back(): void {
        if (mode === 'service' && player) {
            if (player.currentTime >= SKIP_SECONDS || chunkIndex === 0) {
                player.currentTime = Math.max(0, player.currentTime - SKIP_SECONDS);
                return;
            }
            playFrom(chunkIndex - 1, player.currentTime - SKIP_SECONDS);
            return;
        }
        const justStarted = Date.now() - deviceChunkStartedAt < DEVICE_RESTART_GRACE_MS;
        playFrom(justStarted ? Math.max(0, chunkIndex - 1) : chunkIndex);
    }

    function forward(): void {
        const last = chunkIndex >= chunks.length - 1;
        if (mode === 'service' && player) {
            const target = player.currentTime + SKIP_SECONDS;
            if (target < player.duration || last) {
                player.currentTime = Math.min(target, player.duration || target);
                return;
            }
            playFrom(chunkIndex + 1, target - player.duration);
            return;
        }
        if (!last) {
            playFrom(chunkIndex + 1);
        }
    }

    function seek(fraction: number): void {
        const position = fraction * totalLength;
        const index = Math.max(0, offsets.findLastIndex(offset => offset <= position));
        playFrom(index);
    }

    function jumpTo(index: number): void {
        playFrom(Math.min(Math.max(0, index), chunks.length - 1));
    }

    function stop(): void {
        const current = run + 1;
        halt();
        finish(current);
    }

    return {
        speakingId: readonly(speakingId),
        conversationId: readonly(sourceConversationId),
        label: readonly(sourceLabel),
        paused: readonly(paused),
        progress: readonly(progress),
        chunkTexts: readonly(chunkTexts),
        currentChunk: readonly(currentChunk),
        jumpTo,
        pause,
        resume,
        back,
        forward,
        seek,
        stop,
    };
}

export function useSpeech() {
    const { locale } = useI18n();
    const route = useRoute();
    const supported = import.meta.client && ('speechSynthesis' in window || 'Audio' in window);
    const { stop } = useSpeechPlayer();

    function speak(id: string, markdown: string): void {
        stop();
        const text = speakableText(markdown);
        if (!text) {
            return;
        }
        language = guessLanguage(text, locale.value);
        speakingId.value = id;
        preparingId.value = id;
        sourceConversationId.value = typeof route.params.id === 'string' ? route.params.id : null;
        sourceLabel.value = speakableText(/^#{1,6}\s+(.+)$/m.exec(markdown)?.[1] ?? '') || text.split('\n')[0]!;
        player ??= new Audio();
        player.preservesPitch = true;
        meterSpeechAudio(player);
        // Safari lets an element play later, after the fetch, only if it already played inside the click.
        player.src = silentClip();
        player.play().catch(() => undefined);
        const current = run;
        const provider = speechProvider.value === undefined ? loadSpeechProvider().catch(() => null) : Promise.resolve(speechProvider.value);
        void provider.then((resolved) => {
            if (run !== current) {
                return;
            }
            mode = resolved ? 'service' : 'device';
            chunks = resolved ? speechChunks(text, SERVICE_CHUNK_LENGTH, SERVICE_FIRST_CHUNK_LENGTH) : speechChunks(text);
            offsets = [];
            let position = 0;
            for (const chunk of chunks) {
                offsets.push(position);
                position += chunk.length + 1;
            }
            totalLength = Math.max(1, position);
            clips = new Map();
            chunkIndex = 0;
            currentChunk.value = 0;
            chunkTexts.value = chunks;
            progress.value = 0;
            if (resolved && player) {
                void speakWithService(0, 0, current, player);
            }
            else {
                speakWithDevice(0, current);
            }
        });
    }

    return { supported, speakingId: readonly(speakingId), preparingId: readonly(preparingId), speak, stop };
}
