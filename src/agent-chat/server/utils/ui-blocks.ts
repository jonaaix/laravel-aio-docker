import type { UiBlock, UiCard, UiCardSection, UiCardStatus, UiChartSeries, UiChartType, UiTimelineGroup, UiTimelineItem, UiTimelineState, UiOption, UiPage, UiVariant, UiVariantColumns, UiViewport } from '../../shared/types/ui-block';

const LETTERS = 'abcdef';
const MIN_OPTIONS = 2;
const PAGE_HEIGHT = { min: 240, max: 1200, fallback: 560 };
const PAGE_FILE = /\.html?$/i;
const MAX_CARDS = 12;
const MAX_SECTIONS = 6;
const MAX_LABELS = 100;
const CHART_TYPES: UiChartType[] = ['line', 'bar', 'stacked_bar', 'pie', 'doughnut'];
const MAX_SERIES = 8;
const MAX_GROUPS = 8;
const MAX_ITEMS = 30;
const MAX_LANES = 6;
const MINUTES_PER_DAY = 1440;
const CLOCK_TIME = /^(\d{1,2}):(\d{2})$/;
const DATED_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/;
const TIMELINE_STATES: UiTimelineState[] = ['done', 'active', 'open'];
const CANVAS_COLUMNS: Record<string, UiVariantColumns> = { small: 2, large: 1 };
const CANVASES = Object.keys(CANVAS_COLUMNS);
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
    description: 'The options in order, lettered a), b), c)… automatically; a) is always the recommended one.',
    items: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Short name of the option, such as "Compact list".' },
            description: { type: 'string', description: 'Optional one or two sentences; Markdown allowed.' },
        },
        required: ['title'],
    },
};

const MULTIPLE_PROPERTY = { type: 'boolean', description: 'Optional: true lets the user pick several options.' };

const RECOMMENDED_PROPERTY = { type: 'boolean', description: 'Whether a) is marked as recommended; false when there is no recommendation.' };

export const UI_BLOCK_TOOLS = [
    {
        name: 'show_page',
        description: 'Show an HTML page embedded in your answer at full width, frozen as it is now. '
            + 'Use it for anything the user should look at and try in the browser: a prototype, a report, a visual explanation. Send a revision as a new page.',
        inputSchema: { type: 'object', properties: PAGE_PROPERTIES, required: ['path'] },
    },
    {
        name: 'ask_visual_choice',
        description: 'Show visual design or UX alternatives side by side as selectable cards, each with a live preview of its own HTML file. '
            + 'Only for alternatives that must be seen to be judged; never for plain questions, use ask_choice for those. '
            + 'End your answer right after it and wait for the reply.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Optional short title shown above the cards.' },
                canvas: { type: 'string', enum: CANVASES, description: 'Choose the best suitable between small canvas (350px), e.g. buttons, radios, icons, and large canvas (740px), e.g. cards, tables, forms, pages.' },
                viewport_height: { type: 'integer', description: `How tall each preview is, ${VIEWPORT_HEIGHT.min}–${VIEWPORT_HEIGHT.max}. Default ${VIEWPORT_HEIGHT.fallback}.` },
                variants: {
                    type: 'array',
                    minItems: MIN_OPTIONS,
                    maxItems: LETTERS.length,
                    description: 'The variants in order, lettered a), b), c)… automatically; a) is always the recommended one.',
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
                multiple: MULTIPLE_PROPERTY,
            },
            required: ['canvas', 'variants'],
        },
    },
    {
        name: 'ask_choice',
        description: 'Ask the user a question with options to click, each with an optional description. '
            + 'End your answer right after it and wait for the reply.',
        inputSchema: {
            type: 'object',
            properties: {
                question: { type: 'string', description: 'The question; Markdown allowed.' },
                options: OPTIONS_PROPERTY,
                recommended: RECOMMENDED_PROPERTY,
                multiple: MULTIPLE_PROPERTY,
            },
            required: ['question', 'options'],
        },
    },
    {
        name: 'show_cards',
        description: 'Show a grid of cards: a comparison, a summary, the state of several parts. '
            + 'Group content into sections, each with its own heading, sorted by importance in descending order. '
            + 'Within a section everything looks the same; between sections the appearance differs by importance. '
            + 'Sections without a message stay neutral. '
            + 'List all sections in one call.',
        inputSchema: {
            type: 'object',
            properties: {
                sections: {
                    type: 'array',
                    minItems: 1,
                    maxItems: MAX_SECTIONS,
                    items: {
                        type: 'object',
                        properties: {
                            heading: { type: 'string', description: 'Heading of the section.' },
                            status: { type: 'string', enum: CARD_STATUSES, description: 'Optional message of the section: good, warning or bad.' },
                            cards: {
                                type: 'array',
                                minItems: 1,
                                maxItems: MAX_CARDS,
                                description: 'Cards stand two per row. A normal card is about 360 px wide (around 45 characters per line), a wide card about 740 px (around 90). Pair normal cards; make a card wide when its text needs the room.',
                                items: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string', description: 'Short title of the card.' },
                                        text: { type: 'string', description: 'Optional body; Markdown allowed, such as a short list.' },
                                        wide: { type: 'boolean', description: 'Optional: true takes the whole row.' },
                                    },
                                    required: ['title'],
                                },
                            },
                        },
                        required: ['heading', 'cards'],
                    },
                },
            },
            required: ['sections'],
        },
    },
    {
        name: 'show_chart',
        description: 'Show numbers as a chart: a development over time, a comparison or a share of a whole.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Optional short title shown above the chart.' },
                type: { type: 'string', enum: CHART_TYPES, description: 'pie and doughnut take exactly one series.' },
                labels: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_LABELS, description: 'Labels along the axis, or the slices of a pie.' },
                series: {
                    type: 'array',
                    minItems: 1,
                    maxItems: MAX_SERIES,
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            values: { type: 'array', items: { type: 'number' }, description: 'One number per label.' },
                        },
                        required: ['name', 'values'],
                    },
                },
                unit: { type: 'string', description: 'Optional unit shown with the values, such as "€" or "ms".' },
            },
            required: ['type', 'labels', 'series'],
        },
    },
    {
        name: 'show_timeline',
        description: 'Show a sequence as a timeline: the steps of a plan or task, the course of events, or a grouped list.',
        inputSchema: {
            type: 'object',
            properties: {
                groups: {
                    type: 'array',
                    minItems: 1,
                    maxItems: MAX_GROUPS,
                    items: {
                        type: 'object',
                        properties: {
                            heading: { type: 'string', description: 'Optional heading of the group, such as a day or a phase.' },
                            items: {
                                type: 'array',
                                minItems: 1,
                                maxItems: MAX_ITEMS,
                                items: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string' },
                                        marker: { type: 'string', description: 'Optional short mark beside the line, such as a time, a date or "Step 2".' },
                                        text: { type: 'string', description: 'Optional short text; Markdown allowed.' },
                                        state: { type: 'string', enum: TIMELINE_STATES, description: 'Optional: done, active or open.' },
                                        lane: { type: 'string', description: 'Optional parallel track, such as a team; lanes stand side by side.' },
                                        start: { type: 'string', description: 'Optional "HH:MM" or "YYYY-MM-DD HH:MM"; with times, the group is drawn to scale.' },
                                        end: { type: 'string', description: 'Optional, same format as start.' },
                                    },
                                    required: ['title'],
                                },
                            },
                        },
                        required: ['items'],
                    },
                },
            },
            required: ['groups'],
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

function multipleOf(value: unknown): boolean {
    if (value !== undefined && typeof value !== 'boolean') {
        throw new TypeError('multiple must be true or false.');
    }
    return value === true;
}

function columnsOf(canvas: unknown): UiVariantColumns {
    const columns = typeof canvas === 'string' && Object.hasOwn(CANVAS_COLUMNS, canvas) ? CANVAS_COLUMNS[canvas] : undefined;
    if (!columns) {
        throw new Error(`canvas must be ${CANVASES.join(' or ')}.`);
    }
    return columns;
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
    if (value === undefined || value === null || value === false) {
        return null;
    }
    if (value !== true) {
        throw new TypeError('recommended must be true or false.');
    }
    return options[0]!.letter;
}

function cardsOf(value: unknown, name: string): UiCard[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CARDS) {
        throw new Error(`${name} must list 1 to ${MAX_CARDS} cards.`);
    }
    return value.map((card: unknown, index) => {
        if (typeof card !== 'object' || card === null) {
            throw new TypeError(`${name}[${index}] must be an object with a title.`);
        }
        const { title, text, wide } = card as Record<string, unknown>;
        if (wide !== undefined && typeof wide !== 'boolean') {
            throw new TypeError(`${name}[${index}].wide must be true or false.`);
        }
        return { title: requiredText(title, `${name}[${index}].title`), text: optionalText(text, `${name}[${index}].text`), wide: wide === true };
    });
}

function sectionsOf(value: unknown): UiCardSection[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SECTIONS) {
        throw new Error(`sections must list 1 to ${MAX_SECTIONS} sections.`);
    }
    return value.map((section: unknown, index) => {
        if (typeof section !== 'object' || section === null) {
            throw new TypeError(`sections[${index}] must be an object with a heading and cards.`);
        }
        const { heading, status, cards } = section as Record<string, unknown>;
        const named = optionalText(status, `sections[${index}].status`);
        if (named !== null && !CARD_STATUSES.includes(named as UiCardStatus)) {
            throw new Error(`sections[${index}].status must be one of ${CARD_STATUSES.join(', ')}.`);
        }
        return { heading: requiredText(heading, `sections[${index}].heading`), status: named as UiCardStatus | null, cards: cardsOf(cards, `sections[${index}].cards`) };
    });
}

function chartSeriesOf(value: unknown, labelCount: number): UiChartSeries[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SERIES) {
        throw new Error(`series must list 1 to ${MAX_SERIES} series.`);
    }
    return value.map((series: unknown, index) => {
        const { name, values } = (typeof series === 'object' && series !== null ? series : {}) as Record<string, unknown>;
        if (!Array.isArray(values) || values.length !== labelCount || !values.every(number => typeof number === 'number' && Number.isFinite(number))) {
            throw new Error(`series[${index}].values must hold one number per label (${labelCount}).`);
        }
        return { name: requiredText(name, `series[${index}].name`), values: values as number[] };
    });
}

function chartOf(args: Record<string, unknown>): UiBlock {
    const chartType = args.type as UiChartType;
    if (!CHART_TYPES.includes(chartType)) {
        throw new Error(`type must be one of ${CHART_TYPES.join(', ')}.`);
    }
    if (!Array.isArray(args.labels) || args.labels.length < 1 || args.labels.length > MAX_LABELS) {
        throw new Error(`labels must list 1 to ${MAX_LABELS} labels.`);
    }
    const labels = args.labels.map((label: unknown, index) => requiredText(typeof label === 'number' ? String(label) : label, `labels[${index}]`));
    const series = chartSeriesOf(args.series, labels.length);
    if ((chartType === 'pie' || chartType === 'doughnut') && series.length !== 1) {
        throw new Error(`${chartType} takes exactly one series.`);
    }
    return { kind: 'chart', title: optionalText(args.title, 'title'), chartType, labels, series, unit: optionalText(args.unit, 'unit') };
}

interface PlanTime {
    minute: number;
    dated: boolean;
}

function planTimeOf(value: unknown, name: string): PlanTime | null {
    const text = optionalText(value, name);
    if (text === null) {
        return null;
    }
    const clock = CLOCK_TIME.exec(text);
    const dated = clock ? null : DATED_TIME.exec(text);
    const [hour, minute] = (clock ? clock.slice(1) : dated?.slice(4) ?? []).map(Number);
    if (hour === undefined || minute === undefined || hour > 23 || minute > 59) {
        throw new Error(`${name} must be "HH:MM" or "YYYY-MM-DD HH:MM".`);
    }
    if (clock) {
        return { minute: hour * 60 + minute, dated: false };
    }
    const [year, month, day] = dated!.slice(1, 4).map(Number) as [number, number, number];
    const moment = new Date(Date.UTC(year, month - 1, day, hour, minute));
    if (moment.getUTCMonth() !== month - 1 || moment.getUTCDate() !== day) {
        throw new Error(`${name} is not a valid date.`);
    }
    return { minute: moment.getTime() / 60000, dated: true };
}

function spanEndOf(start: PlanTime | null, end: PlanTime | null, name: string): number | null {
    if (end === null) {
        return null;
    }
    if (start === null) {
        throw new Error(`${name}.end needs a start.`);
    }
    if (end.dated !== start.dated) {
        throw new Error(`${name}: start and end must use the same format.`);
    }
    if (end.minute === start.minute || (end.dated && end.minute < start.minute)) {
        throw new Error(`${name}.end must be after its start.`);
    }
    return end.minute < start.minute ? end.minute + MINUTES_PER_DAY : end.minute;
}

function timelineItemOf(item: unknown, name: string): UiTimelineItem & { dated: boolean | null } {
    const { title, marker, text, state, lane, start, end } = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const named = optionalText(state, `${name}.state`);
    if (named !== null && !TIMELINE_STATES.includes(named as UiTimelineState)) {
        throw new Error(`${name}.state must be one of ${TIMELINE_STATES.join(', ')}.`);
    }
    const startTime = planTimeOf(start, `${name}.start`);
    return {
        title: requiredText(title, `${name}.title`),
        marker: optionalText(marker, `${name}.marker`),
        text: optionalText(text, `${name}.text`),
        state: named as UiTimelineState | null,
        lane: optionalText(lane, `${name}.lane`),
        start: startTime?.minute ?? null,
        end: spanEndOf(startTime, planTimeOf(end, `${name}.end`), name),
        dated: startTime?.dated ?? null,
    };
}

function allOrNone(items: UiTimelineItem[], key: 'start' | 'lane', name: string): void {
    const given = items.filter(item => item[key] !== null).length;
    if (given > 0 && given < items.length) {
        throw new Error(`${name}: give every item a ${key} or none.`);
    }
}

function timelineOf(value: unknown): UiTimelineGroup[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_GROUPS) {
        throw new Error(`groups must list 1 to ${MAX_GROUPS} groups.`);
    }
    return value.map((group: unknown, groupIndex) => {
        const { heading, items } = (typeof group === 'object' && group !== null ? group : {}) as Record<string, unknown>;
        if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) {
            throw new Error(`groups[${groupIndex}].items must list 1 to ${MAX_ITEMS} items.`);
        }
        const name = `groups[${groupIndex}]`;
        const parsed = items.map((item: unknown, index) => timelineItemOf(item, `${name}.items[${index}]`));
        allOrNone(parsed, 'start', name);
        allOrNone(parsed, 'lane', name);
        if (new Set(parsed.map(item => item.dated)).size > 1) {
            throw new Error(`${name}: use one time format for all items.`);
        }
        if (new Set(parsed.map(item => item.lane)).size > MAX_LANES) {
            throw new Error(`${name} may use at most ${MAX_LANES} lanes.`);
        }
        return {
            heading: optionalText(heading, `${name}.heading`),
            dated: parsed[0]!.dated === true,
            items: parsed.map(({ dated: _dated, ...item }) => item),
        };
    });
}

export function uiBlockFor(tool: string, args: Record<string, unknown>, storePage: PageStore): UiBlock {
    if (tool === 'ask_choice') {
        const question = requiredText(args.question, 'question');
        const options = optionsOf(args.options, 'options');
        return { kind: 'choice', question, options, recommended: recommendedOf(args.recommended, options), multiple: multipleOf(args.multiple) };
    }
    const title = optionalText(args.title, 'title');
    if (tool === 'show_timeline') {
        return { kind: 'timeline', groups: timelineOf(args.groups) };
    }
    if (tool === 'show_chart') {
        return chartOf(args);
    }
    if (tool === 'show_cards') {
        return { kind: 'cards', sections: sectionsOf(args.sections) };
    }
    if (tool === 'ask_visual_choice') {
        const columns = columnsOf(args.canvas);
        const viewport = { height: wholeNumber(args.viewport_height, 'viewport_height', VIEWPORT_HEIGHT) };
        const options = variantsOf(args, viewport, storePage);
        return { kind: 'variants', title, columns, viewport, options, recommended: recommendedOf(args.recommended, options), multiple: multipleOf(args.multiple) };
    }
    return { kind: 'page', title, page: pageOf(args, storePage) };
}
