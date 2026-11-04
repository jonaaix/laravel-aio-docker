const PREFERRED_FORMATS = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
const DENIED = 'NotAllowedError';
const WAVE_BARS = 12;
const WAVE_FRAME_MS = 60;
const LEVEL_GAIN = 4;
// Google Cloud transcribes at most one minute per request, so its recordings go out in pieces.
const GOOGLE_SEGMENT_MS = 55_000;

export type DictationState = 'idle' | 'recording' | 'transcribing';

export function useDictation(onText: (text: string) => void) {
    const { t, locale } = useI18n();
    const provider = useSpeechProvider();
    const state = ref<DictationState>('idle');
    const error = ref<Error>();
    const levels = shallowRef<number[]>(Array(WAVE_BARS).fill(0));
    let recorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let segments: Blob[] = [];
    let finishing = false;
    let segmentTimer: ReturnType<typeof setInterval> | undefined;
    let listening: AudioContext | null = null;
    let frame = 0;

    function listen(source: MediaStream): void {
        listening = new AudioContext();
        void listening.resume();
        const analyser = listening.createAnalyser();
        analyser.fftSize = 256;
        listening.createMediaStreamSource(source).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        let last = 0;
        const tick = (now: number) => {
            frame = requestAnimationFrame(tick);
            if (now - last < WAVE_FRAME_MS) {
                return;
            }
            last = now;
            analyser.getByteTimeDomainData(samples);
            const power = samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length;
            levels.value = [...levels.value.slice(1), Math.min(1, Math.sqrt(power) * LEVEL_GAIN)];
        };
        frame = requestAnimationFrame(tick);
    }

    function release(): void {
        cancelAnimationFrame(frame);
        void listening?.close();
        listening = null;
        levels.value = Array(WAVE_BARS).fill(0);
        clearInterval(segmentTimer);
        stream?.getTracks().forEach(track => track.stop());
        stream = null;
        recorder = null;
    }

    async function transcribeSegment(recording: Blob): Promise<string> {
        const form = new FormData();
        form.append('audio', recording, 'recording');
        form.append('language', locale.value);
        return (await apiFetch<{ text: string }>('speech/transcribe', { method: 'POST', body: form })).text;
    }

    async function transcribe(recordings: Blob[]): Promise<void> {
        state.value = 'transcribing';
        try {
            const texts: string[] = [];
            for (const recording of recordings) {
                texts.push(await transcribeSegment(recording));
            }
            const text = texts.filter(Boolean).join(' ');
            if (text) {
                onText(text);
            }
        }
        catch {
            error.value = new Error(t('The recording could not be transcribed'));
        }
        finally {
            state.value = 'idle';
        }
    }

    function record(source: MediaStream, mimeType: string | undefined): MediaRecorder {
        const active = new MediaRecorder(source, mimeType ? { mimeType } : undefined);
        const chunks: Blob[] = [];
        active.ondataavailable = event => chunks.push(event.data);
        active.onstop = () => {
            segments.push(new Blob(chunks, { type: active.mimeType }));
            if (finishing) {
                release();
                void transcribe(segments);
            }
            else {
                recorder = record(source, mimeType);
            }
        };
        active.start();
        return active;
    }

    async function start(): Promise<void> {
        error.value = undefined;
        let source: MediaStream;
        let mimeType: string | undefined;
        try {
            source = await navigator.mediaDevices.getUserMedia({ audio: true });
            mimeType = PREFERRED_FORMATS.find(format => MediaRecorder.isTypeSupported(format));
            stream = source;
            segments = [];
            finishing = false;
            recorder = record(source, mimeType);
        }
        catch (failure) {
            error.value = new Error((failure as Error).name === DENIED ? t('Microphone access was denied') : t('No microphone is available'));
            return;
        }
        if (provider.value === 'google') {
            segmentTimer = setInterval(() => recorder?.stop(), GOOGLE_SEGMENT_MS);
        }
        listen(source);
        state.value = 'recording';
    }

    function stop(): void {
        finishing = true;
        clearInterval(segmentTimer);
        recorder?.stop();
    }

    function toggle(): void {
        if (state.value === 'recording') {
            stop();
        }
        else if (state.value === 'idle') {
            void start();
        }
    }

    onBeforeUnmount(() => {
        if (recorder) {
            recorder.onstop = null;
            recorder.stop();
            release();
        }
    });

    return { state: readonly(state), error, levels, toggle };
}
