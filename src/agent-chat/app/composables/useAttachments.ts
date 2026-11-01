import type { UploadedFile } from '#shared/types/conversation';

export interface PendingAttachment {
    key: string;
    filename: string;
    size: number;
    previewUrl: string | null;
    upload: UploadedFile | null;
    error: string | null;
}

function uploadError(error: unknown): string {
    const message = (error as { data?: { statusMessage?: string } }).data?.statusMessage;
    return message || 'Upload failed';
}

let nextKey = 0;

export function useAttachments() {
    const attachments = ref<PendingAttachment[]>([]);
    const uploading = computed(() => attachments.value.some(attachment => !attachment.upload && !attachment.error));
    const ready = computed(() => attachments.value.flatMap(attachment => attachment.upload ? [attachment.upload] : []));

    function release(attachment: PendingAttachment): void {
        if (attachment.previewUrl) {
            URL.revokeObjectURL(attachment.previewUrl);
        }
    }

    async function upload(file: File, attachment: PendingAttachment): Promise<void> {
        try {
            const uploaded = await apiFetch<UploadedFile>('uploads', {
                method: 'PUT',
                query: { name: file.name },
                body: file,
                headers: { 'content-type': 'application/octet-stream' },
            });
            if (attachments.value.includes(attachment)) {
                attachment.upload = uploaded;
            }
            else {
                await apiFetch(`uploads/${uploaded.id}`, { method: 'DELETE' });
            }
        }
        catch (error) {
            attachment.error = uploadError(error);
        }
    }

    function add(files: Iterable<File>): void {
        for (const file of files) {
            const attachment = reactive<PendingAttachment>({
                key: `${Date.now()}-${nextKey++}`,
                filename: file.name || 'file',
                size: file.size,
                previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
                upload: null,
                error: null,
            });
            attachments.value.push(attachment);
            upload(file, attachment);
        }
    }

    function remove(key: string): void {
        const attachment = attachments.value.find(candidate => candidate.key === key);
        if (!attachment) {
            return;
        }
        attachments.value = attachments.value.filter(candidate => candidate !== attachment);
        release(attachment);
        if (attachment.upload) {
            apiFetch(`uploads/${attachment.upload.id}`, { method: 'DELETE' });
        }
    }

    function take(): UploadedFile[] {
        const taken = ready.value;
        attachments.value.forEach(release);
        attachments.value = [];
        return taken;
    }

    onBeforeUnmount(() => attachments.value.forEach(release));

    return { attachments, uploading, ready, add, remove, take };
}
