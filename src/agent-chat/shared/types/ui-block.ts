export const UI_BLOCK_PART = 'data-ui-block';

export interface UiOption {
    letter: string;
    title: string;
    description: string | null;
}

export interface UiPage {
    url: string;
    height: number;
}

export type UiBlock =
    | { kind: 'page'; title: string | null; page: UiPage }
    | { kind: 'variants'; title: string | null; page: UiPage; options: UiOption[]; recommended: string | null }
    | { kind: 'choice'; question: string; options: UiOption[]; recommended: string | null };
