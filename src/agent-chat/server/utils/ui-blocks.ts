import type { UiBlock, UiCard, UiCardStatus, UiOption, UiPage } from '../../shared/types/ui-block';

const LETTERS = 'abcdef';
const MIN_OPTIONS = 2;
const PAGE_HEIGHT = { min: 240, max: 1200, fallback: 560 };
const PAGE_FILE = /\.html?$/i;
const MAX_CARDS = 12;
const CARD_STATUSES: UiCardStatus[] = ['good', 'warning', 'bad'];

export type PageStore = (path: string) => string;

const PAGE_PROPERTIES = {
    path: { type: 'string', description: 'Absolute path, or a path relative to the working directory, of a self-contained HTML file: styles and scripts inline or from a CDN. Files next to it are not available.' },
    title: { type: 'string', description: 'Optional short title shown above the page.' },
    height: { type: 'integer', description: `Optional height in pixels, ${PAGE_HEIGHT.min}–${PAGE_HEIGHT.max}; the page scrolls inside it. Default ${PAGE_HEIGHT.fallback}.` },
};

const OPTIONS_PROPERTY = {
    type: 'array',
    minItems: MIN_OPTIONS,
    maxItems: LETTERS.length,
    description: 'The options in order; they are lettered a), b), c)… automatically.',
    items: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Short name of the option, such as "Compact list".' },
            description: { type: 'string', description: 'Optional one or two sentences; Markdown allowed.' },
        },
        required: ['title'],
    },
};

const RECOMMENDED_PROPERTY = { type: 'string', description: 'Optional letter of the recommended option, such as "a".' };

export const UI_BLOCK_TOOLS = [
    {
        name: 'show_page',
        description: 'Show an HTML page embedded in your answer at full width, frozen as it is now. '
            + 'Use it for anything the user should look at and try in the browser: a prototype, a report, a visual explanation. Send a revision as a new page.',
        inputSchema: { type: 'object', properties: PAGE_PROPERTIES, required: ['path'] },
    },
    {
        name: 'show_variants',
        description: 'Show design or UX alternatives: an HTML page holding all variants, lettered a), b), c)… on the page itself, with the matching list beneath it. '
            + 'The user picks one with a click and answers in the chat.',
        inputSchema: {
            type: 'object',
            properties: { ...PAGE_PROPERTIES, variants: OPTIONS_PROPERTY, recommended: RECOMMENDED_PROPERTY },
            required: ['path', 'variants'],
        },
    },
    {
        name: 'ask_choice',
        description: 'Ask the user to choose between options in a card they can click. '
            + 'Use it where a plain question in the text would not do, such as options that need a description each. '
            + 'End your answer right after it and wait for the reply.',
        inputSchema: {
            type: 'object',
            properties: {
                question: { type: 'string', description: 'The question; Markdown allowed.' },
                options: OPTIONS_PROPERTY,
                recommended: RECOMMENDED_PROPERTY,
            },
            required: ['question', 'options'],
        },
    },
    {
        name: 'show_cards',
        description: 'Show a grid of cards: a comparison, a summary, the state of several parts. '
            + 'A card with a status is tinted green, amber or red as a whole, so use a status only where it is the message.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Optional short title shown above the cards.' },
                cards: {
                    type: 'array',
                    minItems: 1,
                    maxItems: MAX_CARDS,
                    items: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', description: 'Short title of the card.' },
                            text: { type: 'string', description: 'Optional body; Markdown allowed, such as a short list.' },
                            status: { type: 'string', enum: CARD_STATUSES, description: 'Optional: good, warning or bad.' },
                        },
                        required: ['title'],
                    },
                },
            },
            required: ['cards'],
        },
    },
];

export const UI_BLOCK_TOOL_NAMES = new Set(UI_BLOCK_TOOLS.map(tool => tool.name));

function optionalText(value: unknown, name: string): string | null {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        throw new TypeError(`${name} must be text.`);
    }
    return value.trim() || null;
}

function requiredText(value: unknown, name: string): string {
    const text = optionalText(value, name);
    if (!text) {
        throw new Error(`${name} is required.`);
    }
    return text;
}

function pageOf(args: Record<string, unknown>, storePage: PageStore): UiPage {
    const path = requiredText(args.path, 'path');
    if (!PAGE_FILE.test(path)) {
        throw new Error('path must point to an .html file.');
    }
    const height = args.height ?? PAGE_HEIGHT.fallback;
    if (typeof height !== 'number' || !Number.isInteger(height) || height < PAGE_HEIGHT.min || height > PAGE_HEIGHT.max) {
        throw new Error(`height must be a whole number from ${PAGE_HEIGHT.min} to ${PAGE_HEIGHT.max}.`);
    }
    return { url: storePage(path), height };
}

function optionsOf(value: unknown, name: string): UiOption[] {
    if (!Array.isArray(value) || value.length < MIN_OPTIONS || value.length > LETTERS.length) {
        throw new Error(`${name} must list ${MIN_OPTIONS} to ${LETTERS.length} options.`);
    }
    return value.map((option: unknown, index) => {
        if (typeof option !== 'object' || option === null) {
            throw new TypeError(`${name}[${index}] must be an object with a title.`);
        }
        const { title, description } = option as Record<string, unknown>;
        return { letter: LETTERS[index]!, title: requiredText(title, `${name}[${index}].title`), description: optionalText(description, `${name}[${index}].description`) };
    });
}

function recommendedOf(value: unknown, options: UiOption[]): string | null {
    const letter = optionalText(value, 'recommended')?.toLowerCase().replace(/\)$/, '') ?? null;
    if (letter !== null && !options.some(option => option.letter === letter)) {
        throw new Error(`recommended must be one of the letters ${options.map(option => option.letter).join(', ')}.`);
    }
    return letter;
}

function cardsOf(value: unknown): UiCard[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CARDS) {
        throw new Error(`cards must list 1 to ${MAX_CARDS} cards.`);
    }
    return value.map((card: unknown, index) => {
        if (typeof card !== 'object' || card === null) {
            throw new TypeError(`cards[${index}] must be an object with a title.`);
        }
        const { title, text, status } = card as Record<string, unknown>;
        const named = optionalText(status, `cards[${index}].status`);
        if (named !== null && !CARD_STATUSES.includes(named as UiCardStatus)) {
            throw new Error(`cards[${index}].status must be one of ${CARD_STATUSES.join(', ')}.`);
        }
        return { title: requiredText(title, `cards[${index}].title`), text: optionalText(text, `cards[${index}].text`), status: named as UiCardStatus | null };
    });
}

export function uiBlockFor(tool: string, args: Record<string, unknown>, storePage: PageStore): UiBlock {
    if (tool === 'ask_choice') {
        const question = requiredText(args.question, 'question');
        const options = optionsOf(args.options, 'options');
        return { kind: 'choice', question, options, recommended: recommendedOf(args.recommended, options) };
    }
    const title = optionalText(args.title, 'title');
    if (tool === 'show_cards') {
        return { kind: 'cards', title, cards: cardsOf(args.cards) };
    }
    if (tool === 'show_variants') {
        const options = optionsOf(args.variants, 'variants');
        const recommended = recommendedOf(args.recommended, options);
        return { kind: 'variants', title, page: pageOf(args, storePage), options, recommended };
    }
    return { kind: 'page', title, page: pageOf(args, storePage) };
}
