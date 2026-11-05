<script setup lang="ts">
import type { Chart, ChartConfiguration, ChartDataset } from 'chart.js';
import type { UiChartSeries, UiChartType } from '#shared/types/ui-block';

const props = defineProps<{
    chartType: UiChartType;
    labels: string[];
    series: UiChartSeries[];
    unit: string | null;
}>();

const CHART_HEIGHT_PX = 300;
const HUE_SHIFTS = [0, 60, 120, 180];
const EXTRA_HUE_STEP = 45;
const HOVER_LIGHTNESS_SHIFT = 0.08;
const HOVER_MS = 500;

const canvas = ref<HTMLCanvasElement | null>(null);
const colorMode = useColorMode();
const { tint } = useAppearance();
let chart: Chart | null = null;
let disposed = false;

let pixel: CanvasRenderingContext2D | null = null;

// Chart.js cannot read oklch() and derives its hover shades as black from it, so colours go in as rgba().
function resolvedColor(css: string): string {
    const probe = document.createElement('span');
    probe.style.color = css;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    pixel ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!pixel) {
        return color;
    }
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = color;
    pixel.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = pixel.getImageData(0, 0, 1, 1).data;
    return `rgba(${red}, ${green}, ${blue}, ${alpha! / 255})`;
}

function hoverShade(rgba: string): string {
    return resolvedColor(`oklch(from ${rgba} calc(l - ${HOVER_LIGHTNESS_SHIFT}) c h)`);
}

function seriesColor(index: number): string {
    if (index < HUE_SHIFTS.length) {
        return resolvedColor(`oklch(from var(--ui-primary) l c calc(h + ${HUE_SHIFTS[index]}))`);
    }
    if (index === HUE_SHIFTS.length) {
        return resolvedColor('oklch(from var(--ui-primary) l calc(c * 0.35) h)');
    }
    return resolvedColor(`oklch(from var(--ui-primary) l c calc(h + ${(index - HUE_SHIFTS.length) * EXTRA_HUE_STEP + 30}))`);
}

function configuration(): ChartConfiguration {
    const round = props.chartType === 'pie' || props.chartType === 'doughnut';
    const text = resolvedColor('var(--ui-text-muted)');
    const grid = resolvedColor('var(--ui-border)');
    const surface = resolvedColor('var(--ui-bg)');
    const datasets: ChartDataset[] = round
        ? [{ label: props.series[0]!.name, data: props.series[0]!.values, backgroundColor: props.labels.map((_, index) => seriesColor(index)), hoverBackgroundColor: props.labels.map((_, index) => hoverShade(seriesColor(index))), borderColor: surface, hoverBorderColor: surface, borderWidth: 2 }]
        : props.series.map((series, index) => {
            const color = seriesColor(index);
            return props.chartType === 'line'
                ? { label: series.name, data: series.values, borderColor: color, backgroundColor: color, tension: 0.3, pointRadius: 2, borderWidth: 2 }
                : { label: series.name, data: series.values, backgroundColor: color, hoverBackgroundColor: hoverShade(color), borderRadius: 3 };
        });
    const stacked = props.chartType === 'stacked_bar';
    const axis = { stacked, grid: { color: grid }, border: { color: grid }, ticks: { color: text } };
    return {
        type: round ? props.chartType as 'pie' | 'doughnut' : props.chartType === 'line' ? 'line' : 'bar',
        data: { labels: props.labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            transitions: { active: { animation: { duration: HOVER_MS, easing: 'easeOutQuart' } } },
            plugins: {
                legend: { position: 'top', labels: { color: text, boxWidth: 12, boxHeight: 12 } },
                tooltip: { callbacks: { label: item => `${item.dataset.label ?? ''}: ${formatAmount(Number(item.raw), props.unit)}` } },
            },
            scales: round
                ? {}
                : { x: axis, y: { ...axis, beginAtZero: true, ticks: { color: text, callback: value => formatAmount(Number(value), props.unit) } } },
        },
    };
}

async function draw(): Promise<void> {
    const { Chart: ChartClass, registerables } = await import('chart.js');
    if (disposed || !canvas.value) {
        return;
    }
    ChartClass.register(...registerables);
    ChartClass.defaults.font.family = getComputedStyle(document.body).fontFamily;
    chart?.destroy();
    chart = new ChartClass(canvas.value, configuration());
}

onMounted(draw);
watch([() => colorMode.value, tint], () => nextTick(draw));
onBeforeUnmount(() => {
    disposed = true;
    chart?.destroy();
});
</script>

<template>
    <div class="relative w-full" :style="{ height: `${CHART_HEIGHT_PX}px` }">
        <canvas ref="canvas" role="img" :aria-label="series.map(entry => entry.name).join(', ')" />
    </div>
</template>
