# Fast switching between chats

## Goal

Opening a chat feels instant: the last ten opened chats stay drawn in memory and come back without loading or
redrawing, and drawing a chat for the first time costs less. Finished when switching back to a recently opened chat
shows it at once at the scroll position it was left at, and nothing in a chat kept in the background reacts to keys,
drops, selections or scrolling meant for the open one.

## Milestones

- [x] Listeners on window/document only while the chat is the open one (page, drop zone, quote button, Escape to
      stop, changes panel room)
- [x] Keep the last ten chat pages alive; give each its scroll position back when it returns
- [x] Cheaper drawing: one clock formatter instead of one per message; the long-message clamp measured by its observer
      only, without a forced layout per message
- [x] Measure again (long tasks when switching)

## State

- Done. Measured in the dev build: returning to a kept chat takes 10–60 ms without a request (before: 80–700 ms and a
  fresh load); first opening of a 50-message chat is still ~750 ms of drawing, a small chat ~100 ms.
- Window/document listeners go through `useActiveListener` (attached only while the page is active); the page saves its
  scroll position in a router guard, since `onDeactivated` runs after the next page has replaced the content.

## Decisions

- Five kept chats (user): ten cost the tab about 600 MB in the dev build; loading from the snapshot alone was fast
  but not seamless. The drawn view lives in memory only; it cannot be stored, the data snapshot in IndexedDB
  already covers restarts and remote servers.

## Open

- Nothing.
