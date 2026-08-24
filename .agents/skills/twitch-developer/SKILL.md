---
name: twitch-developer
description: Expert guide for building Twitch stream tools, Helix REST API integration, OAuth2 authentication, chat shoutouts, IRC chat monitoring, and EventSub.
---

# Twitch Developer Integration Guide

## 1. Authentication & OAuth2
Twitch Helix API requires an OAuth 2.0 Access Token with specific scopes sent in headers:
- `Authorization: Bearer <ACCESS_TOKEN>`
- `Client-Id: <CLIENT_ID>`

### Essential Scopes for Stream Control & Shoutouts:
- `moderator:manage:shoutouts` - Send official native Twitch shoutouts (`/shoutout`).
- `moderator:read:shoutouts` - Read shoutout status and cooldowns.
- `user:write:chat` / `chat:edit` - Send messages and custom shoutout templates to chat.
- `user:read:chat` / `chat:read` - Read chat messages and detect active chatters.
- `channel:manage:broadcast` - Update stream title, game/category, and tags.
- `clips:edit` - Create clips with one click.
- `moderator:manage:chat_messages` - Delete messages and clear chat.
- `moderator:manage:banned_users` - Timeout and ban users.
- `moderator:manage:chat_settings` - Toggle emote-only, sub-only, slow mode, follower-only.

### Implicit Grant / PKCE Flow (Client-Side Web Apps):
Direct streamers to:
`https://id.twitch.tv/oauth2/authorize?client_id=<CLIENT_ID>&redirect_uri=<REDIRECT_URI>&response_type=token&scope=<SCOPES_URL_ENCODED>`

To validate token & get current user details:
`GET https://api.twitch.tv/helix/users` (Token in Authorization header).

---

## 2. Twitch Shoutout API (`POST /helix/chat/shoutouts`)
Twitch has a native shoutout endpoint that displays the official Twitch banner overlay to all viewers:

```http
POST https://api.twitch.tv/helix/chat/shoutouts?broadcaster_id={BROADCASTER_ID}&moderator_id={MODERATOR_ID}&to_broadcaster_id={TO_BROADCASTER_ID}
Client-Id: {CLIENT_ID}
Authorization: Bearer {TOKEN}
```
- **Cooldowns**:
  - 2-minute cooldown between any shoutouts from the same broadcaster.
  - 60-minute cooldown for shouting out the *same* user again.
- **Error Handling**:
  - `400`: Bad Request (missing params or broadcaster trying to shoutout themselves).
  - `401`: Missing or invalid token / missing `moderator:manage:shoutouts` scope.
  - `429`: Cooldown limit hit (Rate limited).

---

## 3. Active Chatter Tracking (Twitch IRC via WebSocket)
Connect to Twitch IRC WebSocket for zero-latency chat monitoring:
- WebSocket URL: `wss://irc-ws.chat.twitch.tv:443`
- Commands:
  - `PASS oauth:<ACCESS_TOKEN>`
  - `NICK <USERNAME>`
  - `CAP REQ :twitch.tv/tags twitch.tv/commands`
  - `JOIN #<CHANNEL_NAME>`
- Parse PRIVMSG for:
  - `user-id` (needed for Helix shoutout API)
  - `display-name`
  - `color`
  - `badges` (broadcaster, moderator, vip, subscriber, etc.)
  - Message text and timestamp

---

## 4. Channel Management & Quick Actions
- **Create Clip**:
  `POST https://api.twitch.tv/helix/clips?broadcaster_id={BROADCASTER_ID}`
- **Update Channel Info (Title / Game)**:
  `PATCH https://api.twitch.tv/helix/channels?broadcaster_id={BROADCASTER_ID}`
  Body: `{"game_id": "...", "title": "..."}`
- **Search Categories / Games**:
  `GET https://api.twitch.tv/helix/search/categories?query={QUERY}`
- **Timeout User**:
  `POST https://api.twitch.tv/helix/moderator/bans?broadcaster_id={BROADCASTER_ID}&moderator_id={MODERATOR_ID}`
  Body: `{"data": {"user_id": "{TARGET_ID}", "duration": {SECONDS}, "reason": "{REASON}"}}`
- **Update Chat Settings (Slow / Sub / Emote mode)**:
  `PATCH https://api.twitch.tv/helix/chat/settings?broadcaster_id={BROADCASTER_ID}&moderator_id={MODERATOR_ID}`
