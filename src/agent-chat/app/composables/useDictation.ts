const PREFERRED_FORMATS = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
const DENIED = 'NotAllowedError';
const WAVE_BARS = 12;
const WAVE_FRAME_MS = 60;
const LEVEL_GAIN = 4;

export type DictationState = 'idle' | 'recording' | 'transcribing';

export function useDictation(onText: (text: string) => void) {
    const { t } = useI18n();
    const state = ref<DictationState>('idle');
    const error = ref<Error>();
    const levels = shallowRef<number[]>(Array(WAVE_BARS).fill(0));
    let recorder: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let listening: AudioContext | null = null;
    let frame = 0;

    function listen(stream: MediaStream): void {
        listening = new AudioContext();
        void listening.resume();
        const analyser = listening.createAnalyser();
        analyser.fftSize = 256;
        listening.createMediaStreamSource(stream).connect(analyser);
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
        recorder?.stream.getTracks().forEach(track => track.stop());
        recorder = null;
    }

    async function transcribe(recording: Blob): Promise<void> {
        state.value = 'transcribing';
        try {
            const form = new FormData();
            form.append('audio', recording, 'recording');
            const { text } = await apiFetch<{ text: string }>('speech/transcribe', { method: 'POST', body: form });
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

    async function start(): Promise<void> {
        error.value = undefined;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = PREFERRED_FORMATS.find(format => MediaRecorder.isTypeSupported(format));
            recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        }
        catch (failure) {
            error.value = new Error((failure as Error).name === DENIED ? t('Microphone access was denied') : t('No microphone is available'));
            return;
        }
        chunks = [];
        const active = recorder;
        active.ondataavailable = event => chunks.push(event.data);
        active.onstop = () => {
            const recording = new Blob(chunks, { type: active.mimeType });
            release();
            void transcribe(recording);
        };
        active.start();
        listen(active.stream);
        state.value = 'recording';
    }

    function stop(): void {
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
