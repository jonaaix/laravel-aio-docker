import type { ChatMessage, ChatPart } from '#shared/types/conversation';
import type { UiBlock } from '#shared/types/ui-block';
import { UI_BLOCK_PART } from '#shared/types/ui-block';

export function messageText(message: ChatMessage): string {
    return partsBeforeStopHook(message.parts)
        .flatMap(part => part.type === 'text' && part.text.trim() ? [part.text.trim()] : [])
        .join('\n\n');
}

function sentence(text: string): string {
    return /[.!?:]$/.test(text) ? text : `${text}.`;
}

function blockSpeech(block: UiBlock): string[] {
    if (block.kind === 'cards') {
        return block.sections.map(section => [sentence(section.heading), ...section.cards.map(card => sentence(card.text ? `${card.title}: ${card.text}` : card.title))].join(' '));
    }
    if (block.kind === 'page') {
        return block.title ? [sentence(block.title)] : [];
    }
    const options = block.options.map(option => sentence(`${option.letter.toUpperCase()}, ${option.title}${option.description ? `: ${option.description}` : ''}`));
    const lead = block.kind === 'choice' ? block.question : block.title;
    return [lead ? sentence(lead) : '', ...options].filter(Boolean);
}

function partSpeech(part: ChatPart): string[] {
    if (part.type === 'text') {
        return part.text.trim() ? [part.text.trim()] : [];
    }
    return part.type === UI_BLOCK_PART ? blockSpeech((part as { data: UiBlock }).data) : [];
}

export function messageSpeechText(message: ChatMessage): string {
    return partsBeforeStopHook(message.parts).flatMap(partSpeech).join('\n\n');
}
