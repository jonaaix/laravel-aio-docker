const ATTACK = 0.6;
const RELEASE = 0.12;
const LEVEL_GAIN = 5;
const WORD_PULSE = 0.8;
const WORD_DECAY = 0.9;
const BANDS = 24;
const FIRST_BIN = 2;
const BINS_PER_BAND = 2;
const BAND_ATTACK = 0.7;
const BAND_RELEASE = 0.25;

const level = ref(0);
const time = ref(0);
let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let samples: Uint8Array<ArrayBuffer> | null = null;
let frequencies: Uint8Array<ArrayBuffer> | null = null;
const spectrum = new Float32Array(BANDS);
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

function updateSpectrum(): void {
    if (!analyser || !frequencies) {
        spectrum.fill(0);
        return;
    }
    analyser.getByteFrequencyData(frequencies);
    for (let band = 0; band < BANDS; band++) {
        const start = FIRST_BIN + band * BINS_PER_BAND;
        let sum = 0;
        for (let bin = start; bin < start + BINS_PER_BAND; bin++) {
            sum += frequencies[bin]!;
        }
        const target = sum / BINS_PER_BAND / 255;
        const current = spectrum[band]!;
        spectrum[band] = current + (target - current) * (target > current ? BAND_ATTACK : BAND_RELEASE);
    }
}

function tick(): void {
    updateSpectrum();
    wordLevel *= WORD_DECAY;
    const target = Math.max(measured(), wordLevel);
    level.value = follow(level.value, target, RELEASE);
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
        frequencies = new Uint8Array(analyser.frequencyBinCount);
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
    spectrum.fill(0);
    level.value = 0;
}

export function speechSpectrum(): Float32Array {
    return spectrum;
}

export function useSpeechLevel() {
    return { level: readonly(level), time: readonly(time) };
}
