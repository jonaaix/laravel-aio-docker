interface DrumHit {
    from: number;
    to: number;
    length: number;
    level: number;
}

const CLICK_LEVEL = 0.45;
const CLICK_CUTOFF_HZ = 1400;
const CLICK_SECONDS = 0.08;
const ATTACK_SECONDS = 0.006;
const SILENT = 0.0001;
const MASTER_LEVEL = 0.6;
const SECOND_HIT_DELAY = 0.13;
const START_DELAY = 0.02;

const FIRST_HIT: DrumHit = { from: 195, to: 104, length: 0.26, level: 0.9 };
const SECOND_HIT: DrumHit = { from: 155, to: 70, length: 0.55, level: 1 };

let context: AudioContext | null = null;

function unlock(): void {
    context ??= new AudioContext();
    void context.resume();
}

export function armDoneSound(): void {
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
}

function noise(audio: AudioContext): AudioBuffer {
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * CLICK_SECONDS), audio.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) {
        samples[index] = Math.random() * 2 - 1;
    }
    return buffer;
}

function hit(audio: AudioContext, destination: AudioNode, at: number, { from, to, length, level }: DrumHit): void {
    const body = audio.createOscillator();
    body.frequency.setValueAtTime(from, at);
    body.frequency.exponentialRampToValueAtTime(to, at + length * 0.6);
    const bodyGain = audio.createGain();
    bodyGain.gain.setValueAtTime(SILENT, at);
    bodyGain.gain.exponentialRampToValueAtTime(level, at + ATTACK_SECONDS);
    bodyGain.gain.exponentialRampToValueAtTime(SILENT, at + length);
    body.connect(bodyGain).connect(destination);
    body.start(at);
    body.stop(at + length + 0.05);

    const click = audio.createBufferSource();
    click.buffer = noise(audio);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = CLICK_CUTOFF_HZ;
    const clickGain = audio.createGain();
    clickGain.gain.setValueAtTime(level * CLICK_LEVEL, at);
    clickGain.gain.exponentialRampToValueAtTime(SILENT, at + 0.06);
    click.connect(filter).connect(clickGain).connect(destination);
    click.start(at);
}

export function playDoneSound(): void {
    if (!context || context.state !== 'running') {
        return;
    }
    const master = context.createGain();
    master.gain.value = MASTER_LEVEL;
    master.connect(context.destination);
    const at = context.currentTime + START_DELAY;
    hit(context, master, at, FIRST_HIT);
    hit(context, master, at + SECOND_HIT_DELAY, SECOND_HIT);
}
