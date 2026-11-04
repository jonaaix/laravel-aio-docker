import type { FileChange } from '#shared/types/conversation';

export function useChangesTitle(): (files: FileChange[]) => string {
    const { t } = useI18n();
    return (files) => {
        const { added, removed } = changeTotals(files);
        return `${t('1 file changed | {count} files changed', { count: files.length }, files.length)} · +${added} −${removed}`;
    };
}
