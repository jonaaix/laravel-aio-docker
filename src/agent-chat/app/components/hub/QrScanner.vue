<script setup lang="ts">
import jsQR from 'jsqr';

const emit = defineEmits<{ scanned: [value: string]; close: [] }>();

const { t } = useI18n();

const video = ref<HTMLVideoElement | null>(null);
const problem = ref<string | null>(null);
let stream: MediaStream | null = null;
let frame = 0;
const canvas = document.createElement('canvas');

function read(): void {
    const element = video.value;
    if (element && element.readyState === element.HAVE_ENOUGH_DATA) {
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(element, 0, 0);
        const found = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (found?.data) {
            emit('scanned', found.data);
            return;
        }
    }
    frame = requestAnimationFrame(read);
}

onMounted(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
        problem.value = t('This device has no camera');
        return;
    }
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.value!.srcObject = stream;
        await video.value!.play();
        frame = requestAnimationFrame(read);
    }
    catch (failure) {
        problem.value = (failure as DOMException).name === 'NotAllowedError' ? t('Camera access is off') : t('This device has no camera');
    }
});

onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => track.stop());
});
</script>

<template>
    <div class="flex flex-col gap-3">
        <div class="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
            <video ref="video" playsinline muted class="size-full object-cover" />
            <div v-if="problem" class="absolute inset-0 flex items-center justify-center p-5 text-center text-sm text-white/80">{{ problem }}</div>
        </div>
        <p v-if="!problem" class="text-sm text-muted">{{ t('Point the camera at the QR code in Remote control.') }}</p>
        <UButton :label="t('Cancel')" color="neutral" variant="outline" class="self-end" @click="emit('close')" />
    </div>
</template>
