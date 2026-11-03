export function defaultLabels(t) {
    return {
        dialog: t('Image viewer'),
        counter: ':current / :total',
        image: t('Image {number}', { number: ':number' }),
        open: t('Open image'),
        previous: t('Previous image'),
        next: t('Next image'),
        close: t('Close'),
        zoomIn: t('Zoom in'),
        zoomOut: t('Zoom out'),
        play: t('Start slideshow'),
        pause: t('Pause slideshow'),
        fullscreen: t('Full screen'),
        exitFullscreen: t('Exit full screen'),
        openOriginal: t('Open original'),
    };
}

export function format(template, values) {
    return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`:${key}`, String(value)), template);
}
