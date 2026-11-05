<script setup lang="ts">
interface Point {
    x: number;
    y: number;
}

interface Spike {
    born: number;
    angle: number;
    sigma: number;
    strength: number;
}

const SIZE = 40;
const CENTER = SIZE / 2;
const BASE_RADIUS = 16.6;
const WAVE_MAX = 3;
const INNER_CAP = 0.5;
const REST_WIDTH = 0.6;
const BINS = 96;
const SMOOTHING_PASSES = 2;
const SPIKE_IN = 0.12;
const SPIKE_HOLD = 0.18;
const SPIKE_OUT = 0.25;
const SPIKE_LIFE = SPIKE_IN + SPIKE_HOLD + SPIKE_OUT;
const SPIKE_RATE = 7;
const ROTATION_SPEED = 0.7;
const GRADIENT_SPEED = 90;
const WAVE_SPEED = 2.6;
const SPECTRUM_GAIN = 1.3;
const SPECTRUM_CONTRAST = 1.8;
const WAVE_SHARE = 0.4;

const { level, time } = useSpeechLevel();
const still = import.meta.client && matchMedia('(prefers-reduced-motion: reduce)').matches;
const spikes: Spike[] = [];
let lastTime = 0;

const path = ref('');
const gradientId = useId();
const gradientTurn = computed(() => `rotate(${(time.value * GRADIENT_SPEED) % 360} 0.5 0.5)`);

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function smoothstep(value: number): number {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
}

function angleDifference(angle: number): number {
    const wrapped = (angle + Math.PI) % (Math.PI * 2);
    return (wrapped < 0 ? wrapped + Math.PI * 2 : wrapped) - Math.PI;
}

function spectrumAt(angle: number, bands: Float32Array): number {
    const turn = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
    const position = (1 - Math.abs(2 * turn - 1)) * (bands.length - 1);
    const low = Math.floor(position);
    const high = Math.min(bands.length - 1, low + 1);
    return bands[low]! + (bands[high]! - bands[low]!) * (position - low);
}

function amplitudeAt(angle: number, t: number): number {
    const travelA = 0.5 + 0.5 * Math.sin(angle * 2 - t * 1.8);
    const travelB = 0.5 + 0.5 * Math.sin(angle * 4.6 + t * 1.15 + 1.2);
    const travelC = 0.5 + 0.5 * Math.sin(angle * 7.8 - t * 0.85 + 2.6);
    return clamp(0.15 + 0.55 * travelA + 0.22 * travelB + 0.16 * travelC, 0, 1) ** 1.25;
}

function spikeAt(angle: number, t: number): number {
    return spikes.reduce((sum, spike) => {
        const age = t - spike.born;
        const envelope = age < SPIKE_IN
            ? smoothstep(age / SPIKE_IN)
            : age < SPIKE_IN + SPIKE_HOLD ? 1 : 1 - smoothstep((age - SPIKE_IN - SPIKE_HOLD) / SPIKE_OUT);
        const distance = angleDifference(angle - spike.angle);
        return sum + spike.strength * envelope * Math.exp(-(distance * distance) / (2 * spike.sigma * spike.sigma));
    }, 0);
}

function updateSpikes(t: number, loudness: number): void {
    for (let index = spikes.length - 1; index >= 0; index--) {
        if (t - spikes[index]!.born >= SPIKE_LIFE) {
            spikes.splice(index, 1);
        }
    }
    const elapsed = clamp(t - lastTime, 0, 0.1);
    if (Math.random() < SPIKE_RATE * loudness * elapsed) {
        spikes.push({ born: t, angle: Math.random() * Math.PI * 2, sigma: 0.08 + Math.random() * 0.12, strength: 0.45 + Math.random() * 0.9 });
    }
    lastTime = t;
}

function smoothCircular(values: number[]): number[] {
    let current = values;
    for (let pass = 0; pass < SMOOTHING_PASSES; pass++) {
        const n = current.length;
        current = current.map((_, i) => (current[(i - 2 + n) % n]! + 4 * current[(i - 1 + n) % n]! + 6 * current[i]! + 4 * current[(i + 1) % n]! + current[(i + 2) % n]!) / 16);
    }
    return current;
}

function closedCurve(points: Point[], reverse: boolean): string {
    const n = points.length;
    const order = reverse ? [...points.keys()].reverse() : [...points.keys()];
    const at = (i: number) => points[((i % n) + n) % n]!;
    const step = reverse ? -1 : 1;
    let d = `M${at(order[0]!).x.toFixed(2)} ${at(order[0]!).y.toFixed(2)}`;
    for (const i of order) {
        const p0 = at(i - step);
        const p1 = at(i);
        const p2 = at(i + step);
        const p3 = at(i + 2 * step);
        d += `C${(p1.x + (p2.x - p0.x) / 6).toFixed(2)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(2)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return `${d}Z`;
}

function draw(): void {
    const t = time.value;
    const loudness = still ? 0 : level.value;
    updateSpikes(t, loudness);
    const rotation = t * ROTATION_SPEED;
    const bands = speechSpectrum();
    const outer: number[] = [];
    const inner: number[] = [];
    for (let i = 0; i < BINS; i++) {
        const angle = (i / BINS) * Math.PI * 2 + rotation;
        const wave = amplitudeAt(angle, t * WAVE_SPEED);
        const voice = still ? 0 : spectrumAt(angle - rotation, bands) ** SPECTRUM_CONTRAST * SPECTRUM_GAIN;
        const swell = clamp(voice + (wave * WAVE_SHARE + spikeAt(angle, t) * 0.75) * loudness, 0, 2) ** 1.15 * WAVE_MAX;
        outer.push(BASE_RADIUS + REST_WIDTH + swell);
        inner.push(BASE_RADIUS - INNER_CAP * (0.35 + 0.65 * (1 - wave)) * loudness);
    }
    const toPoints = (radii: number[]) => radii.map((radius, i) => {
        const angle = (i / BINS) * Math.PI * 2 + rotation;
        return { x: CENTER + Math.cos(angle) * radius, y: CENTER + Math.sin(angle) * radius };
    });
    path.value = closedCurve(toPoints(smoothCircular(outer)), false) + closedCurve(toPoints(smoothCircular(inner)), true);
}

watch(time, draw, { immediate: true });
</script>

<template>
    <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="pointer-events-none overflow-visible" aria-hidden="true">
        <defs>
            <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox" :gradientTransform="gradientTurn">
                <stop offset="0" style="stop-color: var(--ai-gradient-from)" />
                <stop offset="0.5" style="stop-color: var(--ai-gradient-via)" />
                <stop offset="1" style="stop-color: var(--ai-gradient-to)" />
            </linearGradient>
        </defs>
        <path :d="path" :fill="`url(#${gradientId})`" fill-rule="evenodd" />
    </svg>
</template>
