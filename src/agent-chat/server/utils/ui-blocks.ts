import type { UiBlock, UiCard, UiCardStatus, UiOption, UiPage, UiVariant, UiVariantColumns, UiViewport } from '../../shared/types/ui-block';

const LETTERS = 'abcdef';
const MIN_OPTIONS = 2;
const PAGE_HEIGHT = { min: 240, max: 1200, fallback: 560 };
const PAGE_FILE = /\.html?$/i;
const MAX_CARDS = 12;
const VARIANT_COLUMNS: UiVariantColumns[] = [1, 2];
const VIEWPORT_WIDTH = { min: 320, max: 2560, fallback: 1280 };
const VIEWPORT_HEIGHT = { min: 240, max: 1600, fallback: 800 };
const CARD_STATUSES: UiCardStatus[] = ['good', 'warning', 'bad'];

export type PageStore = (path: string) => { url: string; fileUrl: string; filename: string };

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

const IN_CHAT_LANGUAGE = ' Write all its texts in the chat language.';

const RECOMMENDED_PROPERTY = { type: 'string', description: 'Optional letter of the recommended option. List the recommended option first, so it is "a".' };

export const UI_BLOCK_TOOLS = [
    {
        name: 'show_page',
        description: 'Show an HTML page embedded in your answer at full width, frozen as it is now. '
            + 'Use it for anything the user should look at and try in the browser: a prototype, a report, a visual explanation. Send a revision as a new page.' + IN_CHAT_LANGUAGE,
        inputSchema: { type: 'object', properties: PAGE_PROPERTIES, required: ['path'] },
    },
    {
        name: 'show_variants',
        description: 'Show visual design or UX alternatives side by side as selectable cards, each with a live preview of its own HTML file. '
            + 'Only for alternatives that must be seen to be judged; never for plain questions, use ask_choice for those. '
            + 'The user selects one and answers in the chat.' + IN_CHAT_LANGUAGE,
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Optional short title shown above the cards.' },
                columns: { type: 'integer', enum: VARIANT_COLUMNS, description: 'Cards per row: 2 only for small elements such as icons, buttons, badges or single inputs; 1 for everything larger, such as cards, tables, forms, sections or whole pages.' },
                viewport_width: { type: 'integer', description: `The screen width in pixels the variants are designed for, ${VIEWPORT_WIDTH.min}–${VIEWPORT_WIDTH.max}; previews are scaled down from it. Default ${VIEWPORT_WIDTH.fallback}.` },
                viewport_height: { type: 'integer', description: `How tall each preview is at that width, ${VIEWPORT_HEIGHT.min}–${VIEWPORT_HEIGHT.max}. Default ${VIEWPORT_HEIGHT.fallback}.` },
                variants: {
                    type: 'array',
                    minItems: MIN_OPTIONS,
                    maxItems: LETTERS.length,
                    description: 'The variants in order; they are lettered a), b), c)… automatically.',
                    items: {
                        type: 'object',
                        properties: {
                            path: PAGE_PROPERTIES.path,
                            title: { type: 'string', description: 'Short name of the variant, such as "Compact list".' },
                            description: { type: 'string', description: 'Optional one or two sentences; Markdown allowed.' },
                        },
                        required: ['path', 'title'],
                    },
                },
                recommended: RECOMMENDED_PROPERTY,
            },
            required: ['columns', 'variants'],
        },
    },
    {
        name: 'ask_choice',
        description: 'Ask the user to choose between options in a card they can click. '
            + 'Use it where a plain question in the text would not do, such as options that need a description each. '
            + 'End your answer right after it and wait for the reply.' + IN_CHAT_LANGUAGE,
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
            + 'A card with a status is tinted green, amber or red as a whole, so use a status only where it is the message.' + IN_CHAT_LANGUAGE,
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

function wholeNumber(value: unknown, name: string, range: { min: number; max: number; fallback: number }): number {
    const number = value ?? range.fallback;
    if (typeof number !== 'number' || !Number.isInteger(number) || number < range.min || number > range.max) {
        throw new Error(`${name} must be a whole number from ${range.min} to ${range.max}.`);
    }
    return number;
}

function storedPage(pathValue: unknown, name: string, height: number, storePage: PageStore): UiPage {
    const path = requiredText(pathValue, name);
    if (!PAGE_FILE.test(path)) {
        throw new Error(`${name} must point to an .html file.`);
    }
    return { ...storePage(path), height, createdAt: Date.now() };
}

function pageOf(args: Record<string, unknown>, storePage: PageStore): UiPage {
    return storedPage(args.path, 'path', wholeNumber(args.height, 'height', PAGE_HEIGHT), storePage);
}

function variantsOf(args: Record<string, unknown>, viewport: UiViewport, storePage: PageStore): UiVariant[] {
    const options = optionsOf(args.variants, 'variants');
    return options.map((option, index) => ({
        ...option,
        page: storedPage((args.variants as Record<string, unknown>[])[index]!.path, `variants[${index}].path`, viewport.height, storePage),
    }));
}

function columnsOf(value: unknown): UiVariantColumns {
    if (!VARIANT_COLUMNS.includes(value as UiVariantColumns)) {
        throw new Error('columns must be 1 or 2.');
    }
    return value as UiVariantColumns;
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
        const columns = columnsOf(args.columns);
        const viewport = { width: wholeNumber(args.viewport_width, 'viewport_width', VIEWPORT_WIDTH), height: wholeNumber(args.viewport_height, 'viewport_height', VIEWPORT_HEIGHT) };
        const options = variantsOf(args, viewport, storePage);
        return { kind: 'variants', title, columns, viewport, options, recommended: recommendedOf(args.recommended, options) };
    }
    return { kind: 'page', title, page: pageOf(args, storePage) };
}
