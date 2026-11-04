const REJECTED_KEY = new Set([401, 403]);
const GEMINI_INVALID_KEY = 'API_KEY_INVALID';

export type SpeechFailure = 'key' | 'credit' | 'unavailable';

const FAILURE_STATUS: Record<SpeechFailure, number> = { key: 422, credit: 402, unavailable: 502 };
const FAILURE_MESSAGE: Record<SpeechFailure, string> = {
    key: 'The voice service did not accept the key',
    credit: 'The voice service has no credit left',
    unavailable: 'The voice service did not answer',
};
const NO_CREDIT_STATUS = 402;
const NO_CREDIT_MARKERS = ['insufficient_quota', 'quota_exceeded', 'credits are depleted'];

export class SpeechServiceError extends Error {
    readonly reason: SpeechFailure;

    constructor(reason: SpeechFailure) {
        super(FAILURE_MESSAGE[reason]);
        this.reason = reason;
    }
}

export function speechServiceHttpError(failure: SpeechServiceError) {
    return createError({ statusCode: FAILURE_STATUS[failure.reason], statusMessage: failure.message });
}

const LOGGED_BODY_LENGTH = 600;

export async function serviceFailure(response: Response): Promise<SpeechServiceError> {
    const body = await response.text().catch(() => '');
    console.warn(`[speech] ${response.url} answered ${response.status}: ${body.slice(0, LOGGED_BODY_LENGTH)}`);
    if (REJECTED_KEY.has(response.status) || body.includes(GEMINI_INVALID_KEY)) {
        return new SpeechServiceError('key');
    }
    const noCredit = response.status === NO_CREDIT_STATUS || NO_CREDIT_MARKERS.some(marker => body.includes(marker));
    return new SpeechServiceError(noCredit ? 'credit' : 'unavailable');
}
