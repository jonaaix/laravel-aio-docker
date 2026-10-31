/**
 * Platform-agnostic types for multi-platform support
 *
 * These types normalize the differences between Mattermost, Slack, etc.
 * into a common interface that SessionManager can work with.
 */

/**
 * Normalized user representation across platforms
 */
export interface PlatformUser {
  id: string;           // Platform-specific user ID
  username: string;     // Login username (e.g., 'alice.smith')
  displayName?: string; // Human-friendly name (e.g., 'Alice Smith')
  email?: string;       // Optional email
}

/**
 * Normalized post/message representation across platforms
 */
export interface PlatformPost {
  id: string;           // Platform-specific post ID
  platformId: string;   // Which platform instance this is from
  channelId: string;    // Channel/conversation ID
  userId: string;       // Author's user ID
  message: string;      // Message text content
  rootId?: string;      // Thread parent ID (if this is a reply)
  createAt?: number;    // Timestamp (ms since epoch)
  metadata?: {
    files?: PlatformFile[];  // Attached files
    [key: string]: unknown;  // Platform-specific metadata
  };
}

/**
 * Normalized reaction representation across platforms
 */
export interface PlatformReaction {
  userId: string;       // User who reacted
  postId: string;       // Post that was reacted to
  emojiName: string;    // Emoji name (e.g., '+1', 'white_check_mark')
  createAt?: number;    // When the reaction was added
}

/**
 * Normalized file attachment representation across platforms
 */
export interface PlatformFile {
  id: string;           // Platform-specific file ID
  name: string;         // Filename
  size: number;         // File size in bytes
  mimeType: string;     // MIME type (e.g., 'image/png')
  extension?: string;   // File extension
}

/**
 * Normalized thread message for context retrieval
 */
/**
 * Semantic kind of a post, carried as platform metadata (Mattermost post
 * `props.ct_kind`). Lets history read-back tell a real answer message apart from
 * working/tool/status/system posts. Mirrors the operations-layer PostType
 * strings ('content', 'working', 'system', …). Loose (string) on the wire to
 * keep the platform layer decoupled from the operations layer.
 */
export type PostKind = string;

/** Options accepted by post create/update to tag the post's kind on the wire. */
export interface PostOptions {
  kind?: PostKind;
}

/** A file attachment surfaced in thread history, with a URL a bot can fetch. */
export interface ThreadFile {
  id: string;
  name: string;
  url: string;
}

export interface ThreadMessage {
  id: string;           // Message/post ID
  userId: string;       // Author's user ID
  username: string;     // Author's username
  message: string;      // Message content
  createAt: number;     // Timestamp (ms since epoch)
  kind?: PostKind;      // Post kind from platform metadata; undefined for legacy/foreign posts
  files?: ThreadFile[]; // File attachments (with fetch URLs); undefined/empty when none
}
