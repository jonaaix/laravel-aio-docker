import { computed, ref } from 'vue';

export const SLIDE_DURATION = 350;
export const SLIDE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function useSlider({ count, loop, width, start = 0 }) {
    const index = ref(start);
    const target = ref(start);
    const offset = ref(0);
    const animating = ref(false);
    const jump = ref(null);
    let timer = null;
    let pending = null;
    let runningDelta = 0;

    const total = computed(() => count());

    function wrap(value) {
        const n = total.value;

        return n === 0 ? 0 : ((value % n) + n) % n;
    }

    function canStep(delta) {
        if (total.value < 2) {
            return false;
        }

        return loop() || (index.value + delta >= 0 && index.value + delta < total.value);
    }

    const prevIndex = computed(() => (jump.value?.direction === -1 ? jump.value.position : canStep(-1) ? wrap(index.value - 1) : null));
    const nextIndex = computed(() => (jump.value?.direction === 1 ? jump.value.position : canStep(1) ? wrap(index.value + 1) : null));

    function settle(onDone) {
        animating.value = true;
        clearTimeout(timer);
        pending = onDone ?? null;
        timer = setTimeout(finish, SLIDE_DURATION);
    }

    function finish() {
        clearTimeout(timer);
        const done = pending;
        pending = null;
        animating.value = false;
        done?.();
    }

    function interrupt(visualOffset) {
        if (!animating.value) {
            return offset.value;
        }

        const delta = pending ? runningDelta : 0;
        finish();
        offset.value = visualOffset + delta * width();

        return offset.value;
    }

    function afterRunning(action) {
        if (!animating.value) {
            return false;
        }

        finish();
        requestAnimationFrame(() => requestAnimationFrame(action));

        return true;
    }

    function step(delta) {
        if (afterRunning(() => step(delta))) {
            return true;
        }

        if (!canStep(delta)) {
            settle();
            offset.value = 0;

            return false;
        }

        offset.value = -delta * width();
        target.value = wrap(index.value + delta);
        runningDelta = delta;
        settle(() => {
            index.value = wrap(index.value + delta);
            offset.value = 0;
        });

        return true;
    }

    function goTo(position) {
        const next = wrap(position);

        if (afterRunning(() => goTo(position))) {
            return;
        }

        if (next === index.value) {
            return;
        }

        const direction = next === wrap(index.value - 1) || (next < index.value && next !== wrap(index.value + 1)) ? -1 : 1;

        jump.value = { position: next, direction };
        runningDelta = direction;
        offset.value = -direction * width();
        target.value = next;
        settle(() => {
            index.value = next;
            jump.value = null;
            offset.value = 0;
        });
    }

    function drag(dx) {
        const resisted = (dx > 0 && prevIndex.value === null) || (dx < 0 && nextIndex.value === null);
        offset.value = resisted ? dx / 3 : dx;
    }

    function release(dx, velocity) {
        const threshold = width() * 0.18;

        if (dx < -threshold || velocity < -0.45) {
            return step(1);
        }

        if (dx > threshold || velocity > 0.45) {
            return step(-1);
        }

        settle();
        offset.value = 0;

        return false;
    }

    function reset(destination = 0) {
        clearTimeout(timer);
        pending = null;
        animating.value = false;
        jump.value = null;
        index.value = wrap(destination);
        target.value = index.value;
        offset.value = 0;
    }

    return { index, target, offset, animating, prevIndex, nextIndex, step, goTo, drag, release, reset, interrupt, wrap };
}
