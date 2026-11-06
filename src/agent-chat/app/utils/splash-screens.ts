const IPHONE_SCREENS = [
    { image: '750x1334', width: 375, height: 667, ratio: 2 },
    { image: '828x1792', width: 414, height: 896, ratio: 2 },
    { image: '1125x2436', width: 375, height: 812, ratio: 3 },
    { image: '1170x2532', width: 390, height: 844, ratio: 3 },
    { image: '1179x2556', width: 393, height: 852, ratio: 3 },
    { image: '1206x2622', width: 402, height: 874, ratio: 3 },
    { image: '1242x2208', width: 414, height: 736, ratio: 3 },
    { image: '1242x2688', width: 414, height: 896, ratio: 3 },
    { image: '1260x2736', width: 420, height: 912, ratio: 3 },
    { image: '1284x2778', width: 428, height: 926, ratio: 3 },
    { image: '1290x2796', width: 430, height: 932, ratio: 3 },
    { image: '1320x2868', width: 440, height: 956, ratio: 3 },
];

export function splashScreenLinks(baseUrl: string): { rel: 'apple-touch-startup-image'; href: string; media: string }[] {
    return (['dark', 'light'] as const).flatMap(scheme => IPHONE_SCREENS.map(screen => ({
        rel: 'apple-touch-startup-image' as const,
        href: `${baseUrl}splash/${scheme}-${screen.image}.png`,
        media: `(device-width: ${screen.width}px) and (device-height: ${screen.height}px) and (-webkit-device-pixel-ratio: ${screen.ratio}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})`,
    })));
}
