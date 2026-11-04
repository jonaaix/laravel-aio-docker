---
name: agent-chat-integration
description: How the Laravel app connects to the agent chat that runs beside it in this container — requesting a sign-in link for the signed-in user and putting the chat panel into the app's pages. Use when asked to add a chat button, sign people in to the chat, embed or remove the chat panel, or when the chat answers "Unauthorized".
---

# Agent chat integration

The agent chat runs beside the Laravel app. Nobody can get in without a signed link, and only the chat
signs these links. The Laravel app is the door: for its signed-in user it asks the chat for a link and
sends the browser there. Opening the link signs that person in to that browser for good, until the
chat's key changes.

Two values connect the app to the chat. Keep both in `.env`:

```dotenv
AGENT_CHAT_URL=http://localhost:3000
AGENT_CHAT_KEY=<the chat's key>
```

`AGENT_CHAT_KEY` is a secret. It never reaches the browser and is never committed, logged or shown in a reply.
Expose both through `config/services.php` as `services.agent_chat.url` and `services.agent_chat.key`.

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

Add it once to the main layout, right before `</body>`, for local development only:

```blade
@if (app()->environment('local'))
    <script src="{{ config('services.agent_chat.url') }}/overlay.js" defer></script>
@endif
```

- The script takes care of itself: no build step, no styles, no Vite entry. It does nothing inside an iframe and
  never loads twice.
- The panel only loads the chat once it is opened.
- Someone who has never signed in sees "Unauthorized" in the panel. Signing in once through the route above fixes
  that for good in this browser.
- If the app sends a `Content-Security-Policy`, allow `AGENT_CHAT_URL` in `script-src` and `frame-src`.
- Fixed elements of the app (sticky headers, toasts) do not move with the page when the panel opens. That is
  accepted; do not rework the app's layout for it.

## Not settled yet

- The chat's address inside this container and where its key is kept are not fixed yet. Until they are, ask the
  user for both and put them into `.env` as above.
- Signing in through the route only reaches the panel while the chat and the app share a site (same host,
  different ports count as the same site). On separate domains the panel cannot see that sign-in; tell the user
  instead of working around it.
