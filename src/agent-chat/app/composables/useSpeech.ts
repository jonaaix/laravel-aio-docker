const speakingId = ref<string | null>(null);
let run = 0;

function pickVoice(language: string): SpeechSynthesisVoice | undefined {
    const voices = speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith(language));
    return voices.find(voice => /premium|enhanced/i.test(voice.name))
        ?? voices.find(voice => voice.default)
        ?? voices[0];
}

export function useSpeech() {
    const { locale } = useI18n();
    const { speechRate } = useAppearance();
    const supported = import.meta.client && 'speechSynthesis' in window;

    function stop(): void {
        run++;
        speakingId.value = null;
        speechSynthesis.cancel();
    }

    function speak(id: string, markdown: string): void {
        stop();
        const text = speakableText(markdown);
        if (!text) {
            return;
        }
        const language = guessLanguage(text, locale.value);
        const voice = pickVoice(language);
        const chunks = speechChunks(text);
        const current = run;
        const finish = () => {
            if (run === current) {
                speakingId.value = null;
            }
        };
        speakingId.value = id;
        chunks.forEach((chunk, index) => {
            const utterance = new SpeechSynthesisUtterance(chunk);
            utterance.lang = voice?.lang ?? language;
            utterance.voice = voice ?? null;
            utterance.rate = speechRate.value;
            utterance.onerror = finish;
            if (index === chunks.length - 1) {
                utterance.onend = finish;
            }
            speechSynthesis.speak(utterance);
        });
    }

    return { supported, speakingId: readonly(speakingId), speak, stop };
}
