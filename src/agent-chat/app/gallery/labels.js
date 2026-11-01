export const DEFAULT_LABELS = {
    dialog: 'Image viewer',
    counter: ':current / :total',
    image: 'Image :number',
    open: 'Open image',
    previous: 'Previous image',
    next: 'Next image',
    close: 'Close',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    play: 'Start slideshow',
    pause: 'Pause slideshow',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    openOriginal: 'Open original',
};

export function format(template, values) {
    return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`:${key}`, String(value)), template);
}
