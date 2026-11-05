export const UI_BLOCK_PART = 'data-ui-block';

export interface UiOption {
    letter: string;
    title: string;
    description: string | null;
}

export interface UiPage {
    url: string;
    fileUrl: string;
    filename: string;
    height: number;
    createdAt: number;
}

export interface UiVariant extends UiOption {
    page: UiPage;
}

export type UiVariantColumns = 1 | 2;

export interface UiViewport {
    width: number;
    height: number;
}

export type UiCardStatus = 'good' | 'warning' | 'bad';

export interface UiCard {
    title: string;
    text: string | null;
    status: UiCardStatus | null;
}

export type UiBlock =
    | { kind: 'page'; title: string | null; page: UiPage }
    | { kind: 'variants'; title: string | null; columns: UiVariantColumns; viewport: UiViewport; options: UiVariant[]; recommended: string | null }
    | { kind: 'choice'; question: string; options: UiOption[]; recommended: string | null }
    | { kind: 'cards'; title: string | null; cards: UiCard[] };
