---
name: agent-chat-integration
description: How the Laravel app connects to the agent chat that runs beside it in this container — requesting a sign-in link for the signed-in user and putting the chat panel into the app's pages. Use when asked to add a chat button, sign people in to the chat, embed or remove the chat panel, or when the chat answers "Unauthorized".
---

# Agent chat integration

The agent chat runs beside the Laravel app. Nobody can get in without a signed link, and only the chat
signs these links. The Laravel app is the door: for its signed-in user it asks the chat for a link and
sends the browser there. Opening the link signs that person in to that browser for good, until the
chat's key changes.

Two values connect the app to the chat: its address and its key. The chat creates its key on its first start and
keeps it in `/home/laravel/.config/agent-chat/chat-key`; the app reads it from there, so it never needs copying.
Only a chat that runs somewhere else is given the key through `AGENT_CHAT_KEY` in `.env`, the same value that chat
runs with as `NUXT_CHAT_KEY`.

```php
// config/services.php
'agent_chat' => [
    'url' => env('AGENT_CHAT_URL', 'http://localhost:3000'),
    'key' => env('AGENT_CHAT_KEY') ?: trim((string) @file_get_contents('/home/laravel/.config/agent-chat/chat-key')),
],
```

The key is a secret. It never reaches the browser and is never committed, logged or shown in a reply.

## Requesting a sign-in link

Server-side only:

```http
POST {AGENT_CHAT_URL}/api/auth/links
Authorization: Bearer {AGENT_CHAT_KEY}
Content-Type: application/json

{ "name": "Ada Lovelace", "userRef": "42", "avatarUrl": "https://example.com/ada.png" }
```

- `name` is required. It is the name the person carries in the chat.
- `userRef` is required: the person's stable id in the app, usually the user's primary key. The same `userRef`
  always signs in as the same person. A name that already belongs to another `userRef` is refused.
- `avatarUrl` is optional. When present, the chat fetches the picture and uses it as the person's head.
- Answer `200`: `{ "path": "/?n=…&a=…&exp=…&nonce=…&sig=…" }`. The browser opens `{AGENT_CHAT_URL}{path}`.
- The link works once and only for about a minute. Request it at the moment the person clicks, never earlier,
  and never cache or store it.
- `403` means the person was blocked by a chat admin: tell the user so, do not retry.
- `401` means the key is wrong. `422` means the name or `userRef` is missing. `409` means the name already belongs
  to another person: show the user that their name is taken in the chat, never retry under another name on your own.

A route that signs the current user in and lands them in the chat:

```php
Route::get('/agent-chat', function (Request $request) {
    $chat = config('services.agent_chat');
    $user = $request->user();

    $link = Http::withToken($chat['key'])
        ->acceptJson()
        ->post("{$chat['url']}/api/auth/links", array_filter([
            'name' => $user->name,
            'userRef' => (string) $user->getKey(),
            'avatarUrl' => $user->avatar_url,
        ]))
        ->throw()
        ->json('path');

    return redirect()->away($chat['url'].$link);
})->middleware('auth')->name('agent-chat');
```

Leave out `avatarUrl` if the app has no profile pictures. Link the route wherever the team wants the way into the
chat, for example in the user menu.

## Putting the chat panel into the app

The chat serves a script that adds a chat button at the bottom right of a page. The button opens the chat in a
panel on the right and pushes the page aside. The panel comes back after every page load the way it was left:
open or closed, its width, the open conversation and any unsent text.

The panel appears on exactly the pages whose HTML contains the script tag, so the app decides in its own code where
the chat is available. Put the tag right before `</body>` in the layout of the area that should have the chat,
usually the admin layout:

```blade
{{-- resources/views/layouts/admin.blade.php --}}
    @auth
        <script src="{{ config('services.agent_chat.url') }}/overlay.js" data-sign-in="{{ route('agent-chat') }}" defer></script>
    @endauth
</body>
```

If all pages share one layout, wrap the tag in a condition instead — any route name, role, permission or environment
check the app already has:

```blade
@if (request()->routeIs('admin.*') && auth()->user()?->can('viewAdmin'))
    <script src="{{ config('services.agent_chat.url') }}/overlay.js" data-sign-in="{{ route('agent-chat') }}" defer></script>
@endif
```

If it is not clear which area should get the chat, ask the user before adding the tag.

- The script takes care of itself: no build step, no styles, no Vite entry. It does nothing inside an iframe and
  never loads twice.
- The panel only loads the chat once it is opened. Moving between pages with and without the tag hides the panel
  and brings it back as it was on the next page that has it.
- `data-sign-in` points to the route above. When the panel finds the person not yet signed in to the chat, it opens
  that route once inside the panel and signs them in there, so render the tag only for signed-in users.
- If the app sends a `Content-Security-Policy`, allow `AGENT_CHAT_URL` in `script-src` and `frame-src`.
- The panel signs in by showing the route inside a frame of the app's own page. `X-Frame-Options: SAMEORIGIN` or
  `frame-ancestors 'self'` allow that; `DENY` or `frame-ancestors 'none'` on that route make the sign-in fail.
- Fixed elements of the app (sticky headers, toasts) do not move with the page when the panel opens. That is
  accepted; do not rework the app's layout for it.

## Not settled yet

- The chat's address inside this container is not fixed yet. Until it is, ask the user for it and put it into
  `.env` as `AGENT_CHAT_URL`.
