const ATTACK = 0.6;
const RELEASE = 0.12;
const ECHO_RELEASE = 0.04;
const LEVEL_GAIN = 5;
const WORD_PULSE = 0.8;
const WORD_DECAY = 0.9;

const level = ref(0);
const echo = ref(0);
const time = ref(0);
let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let samples: Uint8Array<ArrayBuffer> | null = null;
let metered: HTMLMediaElement | null = null;
let wordLevel = 0;
let frame = 0;

function follow(current: number, target: number, release: number): number {
    return target > current ? current + (target - current) * ATTACK : current + (target - current) * release;
}

function measured(): number {
    if (!analyser || !samples) {
        return 0;
    }
    analyser.getByteTimeDomainData(samples);
    const power = samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length;
    return Math.min(1, Math.sqrt(power) * LEVEL_GAIN);
}

function tick(): void {
    wordLevel *= WORD_DECAY;
    const target = Math.max(measured(), wordLevel);
    level.value = follow(level.value, target, RELEASE);
    echo.value = follow(echo.value, level.value, ECHO_RELEASE);
    time.value = performance.now() / 1000;
    frame = requestAnimationFrame(tick);
}

export function meterSpeechAudio(audio: HTMLMediaElement): void {
    context ??= new AudioContext();
    void context.resume();
    if (metered !== audio) {
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        samples = new Uint8Array(analyser.fftSize);
        context.createMediaElementSource(audio).connect(analyser);
        analyser.connect(context.destination);
        metered = audio;
    }
    if (!frame) {
        frame = requestAnimationFrame(tick);
    }
}

export function pulseSpokenWord(): void {
    wordLevel = WORD_PULSE;
    if (!frame) {
        frame = requestAnimationFrame(tick);
    }
}

export function stopSpeechLevel(): void {
    cancelAnimationFrame(frame);
    frame = 0;
    wordLevel = 0;
    level.value = 0;
    echo.value = 0;
}

export function useSpeechLevel() {
    return { level: readonly(level), echo: readonly(echo), time: readonly(time) };
}
