/**
 * StreamerDeck by.legionx — Broadcast Deck & Twitch Auto-Shoutout Engine
 * Users just click "Connect Twitch" — no setup needed.
 * Built on Twitch Implicit Grant OAuth (Client ID is public, no secret required).
 */

// ==========================================================================
// APPLICATION STATE
// ==========================================================================

// Public Twitch Client ID (Implicit Grant — safe to hardcode, no secret involved)
// All visitors use this app registration; each user gets their OWN token in their browser.
const DEFAULT_CLIENT_ID = 'iit7nefwjmvapujq4lttes3qbt90y5';
const DEFAULT_CHANNEL = '';

const DEFAULT_MACROS = [
  { id: '1', cmd: '!discord', label: 'Discord Community', message: '📢 Join our official Discord community for alerts, stream schedule, and game nights: https://discord.gg/streamer' },
  { id: '2', cmd: '!socials', label: 'Social Media Links', message: '💜 Follow my socials: Twitter @streamer | YouTube @streamer | TikTok @streamer' },
  { id: '3', cmd: '!prime', label: 'Prime Sub Prompt', message: "⭐ Enjoying the stream? Don't forget you can link your Amazon Prime for a FREE Sub each month!" },
  { id: '4', cmd: '!lurk', label: 'Lurk Acknowledgement', message: '☕ [LURK ACTIVATED] Enjoy your lurk, grab a drink, and thank you so much for the support!' }
];

function loadSavedFavorites() {
  try {
    const raw = localStorage.getItem('sp_chat_favs');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return []; // Default to empty list
}

function loadSavedMacros() {
  try {
    const raw = localStorage.getItem('sp_chat_macros');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [
    { id: '1', cmd: '!discord', label: 'Discord Community', message: '📢 Join our official Discord community for alerts, stream schedule, and game nights: https://discord.gg/streamer' },
    { id: '2', cmd: '!socials', label: 'Social Media Links', message: '💜 Follow my socials: Twitter @streamer | YouTube @streamer | TikTok @streamer' },
    { id: '3', cmd: '!prime', label: 'Prime Sub Prompt', message: "⭐ Enjoying the stream? Don't forget you can link your Amazon Prime for a FREE Sub each month!" },
    { id: '4', cmd: '!lurk', label: 'Lurk Acknowledgement', message: '☕ [LURK ACTIVATED] Enjoy your lurk, grab a drink, and thank you so much for the support!' }
  ];
}

const APP_STATE = {
  auth: {
    clientId: localStorage.getItem('sp_twitch_client_id') || DEFAULT_CLIENT_ID,
    token: localStorage.getItem('sp_twitch_token') || '',
    userId: localStorage.getItem('sp_twitch_user_id') || '',
    username: localStorage.getItem('sp_twitch_username') || '',
    displayName: localStorage.getItem('sp_twitch_display_name') || '',
    avatar: localStorage.getItem('sp_twitch_avatar') || '',
    channel: localStorage.getItem('sp_twitch_channel') || DEFAULT_CHANNEL,
    scopes: []
  },
  settings: {
    soundEnabled: localStorage.getItem('sp_sound') !== 'false',
    postChat: localStorage.getItem('sp_post_chat') !== 'false',
    shoutoutTemplate: localStorage.getItem('sp_so_template') || '⭐ Check out @{username} at https://twitch.tv/{username} ! They were last streaming {game} — give them a follow! 💜',
    simMode: localStorage.getItem('sp_sim_mode') === 'true',
    activeFilter: localStorage.getItem('sp_active_filter') || 'all'
  },
  stream: {
    isLive: false,
    viewers: 0,
    uptimeSeconds: 0,
    title: localStorage.getItem('sp_stream_title') || '🔴 Live Stream & Community Chat',
    game: 'Just Chatting',
    gameId: '509658'
  },
  cooldowns: {
    globalExpiresAt: 0,
    userCooldowns: {}
  },
  chatters: new Map(),
  modes: {
    emote: localStorage.getItem('sp_mode_emote') === 'true',
    sub: localStorage.getItem('sp_mode_sub') === 'true',
    followers: localStorage.getItem('sp_mode_followers') === 'true',
    slow: localStorage.getItem('sp_mode_slow') === 'true'
  },
  macros: loadSavedMacros(),
  favorites: loadSavedFavorites(),
  ircSocket: null,
  ircConnected: false
};

// ==========================================================================
// TACTILE AUDIO SYNTHESIZER
// ==========================================================================

class AudioSynth {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.ctx = new AudioContextClass();
    }
  }

  play(type = 'shoutout') {
    if (!APP_STATE.settings.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      const now = this.ctx.currentTime;

      if (type === 'shoutout') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.18);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'clip') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(960, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'alert') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {
      console.warn('Audio synth failed:', e);
    }
  }
}

const audio = new AudioSynth();

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================

function triggerToast(message, type = 'info', duration = 3500) {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;

  const iconSvg = type === 'success' ? '✓' : type === 'warning' ? '⚠️' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span class="font-mono" aria-hidden="true">${iconSvg}</span><span>${message}</span>`;

  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ==========================================================================
// TWITCH OAUTH & TOKEN VALIDATION
// ==========================================================================

const REQUIRED_SCOPES = [
  'moderator:manage:shoutouts',
  'moderator:read:shoutouts',
  'user:write:chat',
  'user:read:chat',
  'chat:read',
  'chat:edit',
  'channel:manage:broadcast',
  'clips:edit',
  'moderator:manage:chat_messages',
  'moderator:manage:banned_users',
  'moderator:manage:chat_settings'
].join('%20');

function getRedirectUrl() {
  return window.location.origin + window.location.pathname;
}

function processOAuthCallback() {
  const hash = window.location.hash;
  if (!hash) return;

  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');
  if (token) {
    APP_STATE.auth.token = token.replace(/^oauth:/, '');
    localStorage.setItem('sp_twitch_token', APP_STATE.auth.token);
    window.location.hash = '';
    triggerToast('Twitch OAuth token connected! Validating permissions...', 'info');
    validateAndLoadToken();
  }
}

function startTwitchOAuth() {
  // Use DEFAULT_CLIENT_ID (bundled) — users don't need to enter their own
  const clientId = APP_STATE.auth.clientId || DEFAULT_CLIENT_ID;
  APP_STATE.auth.clientId = clientId;
  localStorage.setItem('sp_twitch_client_id', clientId);

  const redirect = encodeURIComponent(getRedirectUrl());
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirect}&response_type=token&scope=${REQUIRED_SCOPES}`;
  window.location.href = authUrl;
}

async function validateAndLoadToken() {
  if (!APP_STATE.auth.token) {
    updateDiagnosticsUI();
    return;
  }

  try {
    // 1. Call Twitch OAuth Validate endpoint
    const valRes = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: {
        'Authorization': `OAuth ${APP_STATE.auth.token}`
      }
    });

    if (!valRes.ok) {
      throw new Error(`Token invalid or expired (HTTP ${valRes.status})`);
    }

    const valData = await valRes.json();
    APP_STATE.auth.clientId = valData.client_id || DEFAULT_CLIENT_ID;
    APP_STATE.auth.userId = valData.user_id;
    APP_STATE.auth.username = valData.login;
    APP_STATE.auth.scopes = valData.scopes || [];

    localStorage.setItem('sp_twitch_client_id', APP_STATE.auth.clientId);
    localStorage.setItem('sp_twitch_user_id', valData.user_id);
    localStorage.setItem('sp_twitch_username', valData.login);

    if (!APP_STATE.auth.channel) {
      APP_STATE.auth.channel = valData.login;
      localStorage.setItem('sp_twitch_channel', valData.login);
    }

    // 2. Fetch User Profile
    const userRes = await fetch(`https://api.twitch.tv/helix/users?id=${valData.user_id}`, {
      headers: {
        'Client-Id': APP_STATE.auth.clientId,
        'Authorization': `Bearer ${APP_STATE.auth.token}`
      }
    });

    if (userRes.ok) {
      const uData = await userRes.json();
      if (uData.data && uData.data[0]) {
        const u = uData.data[0];
        APP_STATE.auth.displayName = u.display_name;
        APP_STATE.auth.avatar = u.profile_image_url;
        localStorage.setItem('sp_twitch_display_name', u.display_name);
        localStorage.setItem('sp_twitch_avatar', u.profile_image_url);
      }
    }

    fetchStreamDetails();
    syncAuthView();
    syncChatSettingsFromTwitch();
    updateDiagnosticsUI();
    triggerToast(`Authenticated as @${APP_STATE.auth.displayName || APP_STATE.auth.username}!`, 'success');

    // Connect to IRC Chat as authenticated broadcaster
    connectToTwitchChannel(APP_STATE.auth.channel || APP_STATE.auth.username);
  } catch (err) {
    console.error('Token validation error:', err);
    triggerToast(`Twitch Auth Error: ${err.message}`, 'error');
    updateDiagnosticsUI();
  }
}

async function fetchStreamDetails() {
  if (!APP_STATE.auth.token || !APP_STATE.auth.clientId || !APP_STATE.auth.userId) return;

  try {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_id=${APP_STATE.auth.userId}`, {
      headers: {
        'Client-Id': APP_STATE.auth.clientId,
        'Authorization': `Bearer ${APP_STATE.auth.token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data[0]) {
        const s = data.data[0];
        APP_STATE.stream.isLive = true;
        APP_STATE.stream.viewers = s.viewer_count;
        APP_STATE.stream.title = s.title;
        APP_STATE.stream.game = s.game_name;
        APP_STATE.stream.gameId = s.game_id;

        const titleInput = document.getElementById('streamTitleInput');
        if (titleInput) titleInput.value = s.title;
        const gameInput = document.getElementById('streamGameInput');
        if (gameInput) gameInput.value = s.game_name;
        
        const viewerCounter = document.getElementById('viewerCounter');
        if (viewerCounter) viewerCounter.textContent = s.viewer_count;
        const liveStatusText = document.getElementById('liveStatusText');
        if (liveStatusText) {
          liveStatusText.textContent = 'LIVE';
          liveStatusText.className = 'live-status-text live';
        }
        const liveBeacon = document.getElementById('liveBeacon');
        if (liveBeacon) liveBeacon.className = 'pulse-beacon live';
      } else {
        APP_STATE.stream.isLive = false;
        const viewerCounter = document.getElementById('viewerCounter');
        if (viewerCounter) viewerCounter.textContent = '0';
        const liveStatusText = document.getElementById('liveStatusText');
        if (liveStatusText) {
          liveStatusText.textContent = 'OFFLINE';
          liveStatusText.className = 'live-status-text';
        }
        const liveBeacon = document.getElementById('liveBeacon');
        if (liveBeacon) liveBeacon.className = 'pulse-beacon';
      }
    }
  } catch (e) {
    console.warn('Could not fetch stream status:', e);
  }
}

function syncAuthView() {
  const connectBtn = document.getElementById('connectTwitchBtn');
  const userCard = document.getElementById('userCard');
  const avatar = document.getElementById('userAvatar');
  const nameEl = document.getElementById('userDisplayName');

  if (APP_STATE.auth.token && APP_STATE.auth.username) {
    if (connectBtn) connectBtn.classList.add('hidden');
    if (userCard) userCard.classList.remove('hidden');
    if (avatar) avatar.src = APP_STATE.auth.avatar || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-70x70.png';
    if (nameEl) nameEl.textContent = APP_STATE.auth.displayName || APP_STATE.auth.username;
  } else {
    if (connectBtn) connectBtn.classList.remove('hidden');
    if (userCard) userCard.classList.add('hidden');
  }
}

function updateDiagnosticsUI() {
  const ircStatus = document.getElementById('ircStatusText');
  const channelDisplay = document.getElementById('currentChannelDisplay');
  const authStatus = document.getElementById('authStatusText');
  const chatLiveDot = document.getElementById('chatLiveDot');

  if (channelDisplay) channelDisplay.textContent = APP_STATE.auth.channel ? `#${APP_STATE.auth.channel}` : 'Not connected';

  if (APP_STATE.settings.simMode) {
    if (authStatus) {
      authStatus.textContent = 'Demo Simulator';
      authStatus.className = 'diag-value text-amber font-mono';
    }
    if (ircStatus) {
      ircStatus.textContent = 'Simulator Engine Active';
      ircStatus.className = 'diag-value text-amber';
    }
    if (chatLiveDot) chatLiveDot.style.background = 'var(--amber-signal)';
    return;
  }

  if (APP_STATE.auth.token && APP_STATE.auth.username) {
    const hasShoutoutScope = APP_STATE.auth.scopes.includes('moderator:manage:shoutouts');
    if (authStatus) {
      authStatus.textContent = `@${APP_STATE.auth.username} (${hasShoutoutScope ? 'Full Scopes' : 'Connected'})`;
      authStatus.className = 'diag-value text-purple font-mono';
    }
  } else {
    if (authStatus) {
      authStatus.textContent = 'Anonymous (Read-Only Chat)';
      authStatus.className = 'diag-value text-muted font-mono';
    }
  }

  if (APP_STATE.ircConnected) {
    if (ircStatus) {
      ircStatus.textContent = `Connected to #${APP_STATE.auth.channel}`;
      ircStatus.className = 'diag-value text-emerald font-mono';
    }
    if (chatLiveDot) chatLiveDot.style.background = 'var(--emerald-live)';
  } else {
    if (ircStatus) {
      ircStatus.textContent = APP_STATE.auth.channel ? `Connecting to #${APP_STATE.auth.channel}...` : 'Idle';
      ircStatus.className = 'diag-value text-muted';
    }
    if (chatLiveDot) chatLiveDot.style.background = 'var(--text-muted)';
  }
}

function handleDisconnect() {
  APP_STATE.auth.token = '';
  APP_STATE.auth.userId = '';
  APP_STATE.auth.username = DEFAULT_CHANNEL.toLowerCase();
  APP_STATE.auth.displayName = DEFAULT_CHANNEL;
  APP_STATE.auth.avatar = '';
  APP_STATE.auth.scopes = [];

  localStorage.removeItem('sp_twitch_token');
  localStorage.removeItem('sp_twitch_user_id');
  localStorage.removeItem('sp_twitch_username');
  localStorage.removeItem('sp_twitch_display_name');
  localStorage.removeItem('sp_twitch_avatar');

  if (APP_STATE.ircSocket) {
    APP_STATE.ircSocket.close();
    APP_STATE.ircSocket = null;
  }
  APP_STATE.ircConnected = false;

  syncAuthView();
  updateDiagnosticsUI();
  triggerToast('Twitch account disconnected.', 'info');
}

// ==========================================================================
// 1-CLICK SHOUTOUT EXECUTION ENGINE (Helix REST API + Chat Command Fallback)
// ==========================================================================

async function fetchTwitchUserProfile(login) {
  if (!APP_STATE.auth.token || !APP_STATE.auth.clientId) return null;
  const clean = login.replace(/^@/, '').trim().toLowerCase();
  if (!clean) return null;

  try {
    const res = await fetch(`https://api.twitch.tv/helix/users?login=${clean}`, {
      headers: {
        'Client-Id': APP_STATE.auth.clientId,
        'Authorization': `Bearer ${APP_STATE.auth.token}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data[0]) return data.data[0];
    }
  } catch (e) {
    console.warn('Failed to fetch user profile:', e);
  }
  return null;
}

async function sendTwitchShoutout(username, userId = null, game = 'Gaming') {
  const clean = username.replace(/^@/, '').toLowerCase().trim();
  const now = Date.now();

  // Cooldown checks
  if (APP_STATE.cooldowns.globalExpiresAt > now) {
    const remaining = Math.ceil((APP_STATE.cooldowns.globalExpiresAt - now) / 1000);
    triggerToast(`Global Cooldown: Wait ${remaining}s before shouting out again.`, 'warning');
    audio.play('alert');
    return;
  }

  if (APP_STATE.cooldowns.userCooldowns[clean] && APP_STATE.cooldowns.userCooldowns[clean] > now) {
    const userRem = Math.ceil((APP_STATE.cooldowns.userCooldowns[clean] - now) / 60000);
    triggerToast(`@${clean} was shouted out recently (${userRem}m cooldown remaining).`, 'warning');
    audio.play('alert');
    return;
  }

  // Set Twitch API cooldown limits (120s global, 3600s per user)
  triggerGlobalCooldown(120);
  APP_STATE.cooldowns.userCooldowns[clean] = now + (60 * 60 * 1000);

  // 1. If in Simulator Mode
  if (APP_STATE.settings.simMode) {
    audio.play('shoutout');
    triggerToast(`⚡ Native Shoutout broadcast for @${clean}!`, 'success');

    if (APP_STATE.settings.postChat) {
      const msg = renderTemplate(clean, game);
      postChatMessage('StreamPulse', msg, { isBroadcaster: true, color: '#9146ff' });
    }

    if (APP_STATE.chatters.has(clean)) {
      APP_STATE.chatters.get(clean).shoutedAt = Date.now();
      refreshChattersDeck();
    }
    return;
  }

  // 2. Real Live Mode Execution
  let helixSuccess = false;

  if (APP_STATE.auth.token && APP_STATE.auth.userId && APP_STATE.auth.clientId) {
    try {
      let targetId = userId;
      if (!targetId) {
        const res = await fetch(`https://api.twitch.tv/helix/users?login=${clean}`, {
          headers: {
            'Client-Id': APP_STATE.auth.clientId,
            'Authorization': `Bearer ${APP_STATE.auth.token}`
          }
        });
        const data = await res.json();
        if (data.data && data.data[0]) targetId = data.data[0].id;
      }

      if (targetId) {
        const url = `https://api.twitch.tv/helix/chat/shoutouts?broadcaster_id=${APP_STATE.auth.userId}&moderator_id=${APP_STATE.auth.userId}&to_broadcaster_id=${targetId}`;
        const soRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Client-Id': APP_STATE.auth.clientId,
            'Authorization': `Bearer ${APP_STATE.auth.token}`
          }
        });

        if (soRes.status === 204 || soRes.status === 200) {
          helixSuccess = true;
          audio.play('shoutout');
          triggerToast(`⚡ Native Twitch Shoutout banner triggered for @${clean}!`, 'success');
        } else {
          const errData = await soRes.json();
          console.warn('Helix shoutout response:', errData);
        }
      }
    } catch (e) {
      console.warn('Helix shoutout error, using chat fallback:', e);
    }
  }

  // Fallback / Chat Announcement
  const chatMsg = renderTemplate(clean, game);
  if (!helixSuccess) {
    sendBroadcasterChatMessage(`/shoutout ${clean}`);
  }
  if (APP_STATE.settings.postChat || !helixSuccess) {
    sendBroadcasterChatMessage(chatMsg);
    audio.play('shoutout');
    triggerToast(`⚡ Shoutout sent for @${clean}!`, 'success');
  }

  if (APP_STATE.chatters.has(clean)) {
    APP_STATE.chatters.get(clean).shoutedAt = Date.now();
    refreshChattersDeck();
  }
}

function triggerGlobalCooldown(seconds = 120) {
  APP_STATE.cooldowns.globalExpiresAt = Date.now() + (seconds * 1000);
  const strip = document.getElementById('globalCooldownStrip');
  const secEl = document.getElementById('globalCooldownSec');
  const fillEl = document.getElementById('globalCooldownFill');

  strip.classList.remove('hidden');

  const interval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((APP_STATE.cooldowns.globalExpiresAt - Date.now()) / 1000));
    secEl.textContent = remaining;
    const pct = (remaining / seconds) * 100;
    fillEl.style.width = `${pct}%`;

    if (remaining <= 0) {
      clearInterval(interval);
      strip.classList.add('hidden');
      refreshChattersDeck();
    }
  }, 500);

  refreshChattersDeck();
}

function renderTemplate(username, game = 'Gaming') {
  return APP_STATE.settings.shoutoutTemplate
    .replace(/{username}/g, username)
    .replace(/{game}/g, game)
    .replace(/{url}/g, `https://twitch.tv/${username}`);
}

// ==========================================================================
// CHATTERS REGISTRY & FEED
// ==========================================================================

function indexChatter(username, displayName, message, role = {}) {
  const clean = username.toLowerCase();
  const existing = APP_STATE.chatters.get(clean);

  const entry = {
    id: role.id || (existing ? existing.id : null),
    username: clean,
    displayName: displayName || username,
    color: role.color || '#9146ff',
    isStreamer: role.isStreamer || false,
    isVip: role.isVip || false,
    isMod: role.isMod || false,
    lastSeen: Date.now(),
    lastMessage: message || '',
    shoutedAt: existing ? existing.shoutedAt : null,
    lastGame: role.lastGame || 'Gaming'
  };

  APP_STATE.chatters.set(clean, entry);
  document.getElementById('chatterCountBadge').textContent = APP_STATE.chatters.size;
  refreshChattersDeck();
}

function refreshChattersDeck() {
  const container = document.getElementById('chatterCardsContainer');
  const filter = APP_STATE.settings.activeFilter;

  const list = Array.from(APP_STATE.chatters.values())
    .filter(c => {
      if (filter === 'streamers') return c.isStreamer;
      if (filter === 'vips') return c.isVip;
      if (filter === 'mods') return c.isMod;
      return true;
    })
    .sort((a, b) => b.lastSeen - a.lastSeen);

  if (list.length === 0) {
    container.innerHTML = `
      <div class="deck-empty-state" id="deckEmptyState">
        <div class="empty-glow-icon">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        </div>
        <h3 id="emptyStateHeading">No chatters yet on #${APP_STATE.auth.channel || 'LegionXIZ'}</h3>
        <p id="emptyStateDesc">When viewers speak in Twitch chat, they pop up here with 1-click shoutout buttons.</p>
        <button class="btn-ghost-cyan" id="simChattersBtn">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          <span>Load Sample Streamers</span>
        </button>
      </div>
    `;
    document.getElementById('simChattersBtn')?.addEventListener('click', loadSimulatedStreamers);
    return;
  }

  container.innerHTML = '';
  const now = Date.now();
  const isGlobalCooldown = APP_STATE.cooldowns.globalExpiresAt > now;

  list.forEach(c => {
    const isUserCooldown = APP_STATE.cooldowns.userCooldowns[c.username] && APP_STATE.cooldowns.userCooldowns[c.username] > now;
    const timeAgo = formatElapsed(c.lastSeen);

    const card = document.createElement('div');
    card.className = `chatter-item-card ${c.shoutedAt ? 'is-shouted' : ''}`;

    let roleHtml = '';
    if (c.isStreamer) roleHtml = '<span class="role-pill-indicator role-creator">LIVE</span>';
    else if (c.isMod) roleHtml = '<span class="role-pill-indicator role-mod">MOD</span>';
    else if (c.isVip) roleHtml = '<span class="role-pill-indicator role-vip">VIP</span>';

    const initial = (c.displayName || c.username).charAt(0).toUpperCase();

    card.innerHTML = `
      <div class="card-identity-group">
        <div class="avatar-badge-holder">
          <div class="avatar-disc" style="border-color: ${c.color};">${initial}</div>
          ${roleHtml}
        </div>
        <div class="card-text-group">
          <div class="card-header-row">
            <span class="card-username font-mono" style="color: ${c.color};">${c.displayName}</span>
            <span class="card-time-ago">${timeAgo}</span>
          </div>
          <p class="card-message-snippet" title="${escapeText(c.lastMessage)}">"${escapeText(c.lastMessage)}"</p>
        </div>
      </div>
      <div>
        ${isUserCooldown ? `
          <span class="cooldown-pill-badge">60m Cooldown</span>
        ` : `
          <button class="btn-deck-shoutout" data-user="${c.username}" data-game="${c.lastGame}" ${isGlobalCooldown ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span>Shoutout</span>
          </button>
        `}
      </div>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll('.btn-deck-shoutout').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const user = btn.getAttribute('data-user');
      const game = btn.getAttribute('data-game') || 'Gaming';
      sendTwitchShoutout(user, null, game);
    });
  });
}

function formatElapsed(timestamp) {
  const sec = Math.floor((Date.now() - timestamp) / 1000);
  if (sec < 8) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ago`;
}

// ==========================================================================
// TWITCH IRC WEBSOCKET (Live Stream Chat Connection with Tag Parsing)
// ==========================================================================

function parseTwitchTags(tagString) {
  const tags = {};
  if (!tagString) return tags;
  const clean = tagString.startsWith('@') ? tagString.slice(1) : tagString;
  const pairs = clean.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx !== -1) {
      const key = pair.slice(0, eqIdx);
      const val = pair.slice(eqIdx + 1);
      tags[key] = val;
    }
  }
  return tags;
}

function connectToTwitchChannel(channelName) {
  const target = channelName.replace(/^#/, '').toLowerCase().trim();
  if (!target) return;

  APP_STATE.auth.channel = target;
  localStorage.setItem('sp_twitch_channel', target);
  
  const inputEl = document.getElementById('quickChannelInput');
  if (inputEl) inputEl.value = target;

  if (APP_STATE.ircSocket) {
    try { APP_STATE.ircSocket.close(); } catch (e) {}
    APP_STATE.ircSocket = null;
  }
  APP_STATE.ircConnected = false;
  updateDiagnosticsUI();

  const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  APP_STATE.ircSocket = ws;

  ws.onopen = () => {
    ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
    
    if (APP_STATE.auth.token && APP_STATE.auth.username) {
      ws.send(`PASS oauth:${APP_STATE.auth.token}`);
      ws.send(`NICK ${APP_STATE.auth.username}`);
    } else {
      const anonNick = 'justinfan' + Math.floor(Math.random() * 89999 + 10000);
      ws.send('PASS SCHMOOPIIE');
      ws.send(`NICK ${anonNick}`);
    }
    
    ws.send(`JOIN #${target}`);
    APP_STATE.ircConnected = true;
    updateDiagnosticsUI();
    triggerToast(`Connected to #${target} chat!`, 'success');
  };

  ws.onmessage = (event) => {
    const raw = event.data;
    if (raw.startsWith('PING')) {
      ws.send('PONG :tmi.twitch.tv');
      return;
    }
    handleIRCLine(raw);
  };

  ws.onerror = (err) => {
    console.error('Twitch IRC WebSocket Error:', err);
    APP_STATE.ircConnected = false;
    updateDiagnosticsUI();
  };

  ws.onclose = () => {
    APP_STATE.ircConnected = false;
    updateDiagnosticsUI();
  };
}

function handleIRCLine(raw) {
  const lines = raw.split('\r\n');
  lines.forEach(l => {
    if (!l) return;
    
    if (l.includes('PRIVMSG')) {
      const privIndex = l.indexOf('PRIVMSG');
      const tagPart = l.slice(0, privIndex).trim();
      const rest = l.slice(privIndex + 7).trim(); // skip PRIVMSG
      
      const colonIndex = rest.indexOf(':');
      const msg = colonIndex !== -1 ? rest.slice(colonIndex + 1) : '';

      const tags = parseTwitchTags(tagPart);

      // Extract username from prefix :user!user@user.tmi.twitch.tv
      let username = 'viewer';
      const prefixMatch = tagPart.match(/:([a-zA-Z0-9_]+)!/);
      if (prefixMatch) {
        username = prefixMatch[1].toLowerCase();
      }

      const displayName = tags['display-name'] || username;
      const color = tags['color'] || '#9146ff';
      const badges = tags['badges'] || '';

      const isBroadcaster = badges.includes('broadcaster') || username === APP_STATE.auth.channel.toLowerCase();
      const isMod = badges.includes('moderator');
      const isVip = badges.includes('vip');
      const isSub = badges.includes('subscriber');

      postChatMessage(displayName, msg, {
        color,
        isBroadcaster,
        isMod,
        isVip,
        isSub,
        username
      });

      indexChatter(username, displayName, msg, {
        id: tags['user-id'],
        color,
        isMod,
        isVip,
        isStreamer: isBroadcaster || isVip
      });
    }
  });
}

function postChatMessage(displayName, text, meta = {}) {
  const viewport = document.getElementById('chatStreamScroll');
  if (!viewport) return;

  const row = document.createElement('div');
  row.className = 'chat-bubble-row';

  let badgesHtml = '';
  if (meta.isBroadcaster) badgesHtml += '<span class="badge-tag b-broadcaster">HOST</span>';
  if (meta.isMod) badgesHtml += '<span class="badge-tag b-mod">MOD</span>';
  if (meta.isVip) badgesHtml += '<span class="badge-tag b-vip">VIP</span>';
  if (meta.isSub) badgesHtml += '<span class="badge-tag b-sub">SUB</span>';

  row.innerHTML = `
    <span class="chat-author-line">
      ${badgesHtml}
      <button class="chat-username-btn font-mono" style="color: ${meta.color || '#9146ff'};" data-user="${meta.username || displayName}">${displayName}:</button>
    </span>
    <span class="chat-message-text">${escapeText(text)}</span>
  `;

  row.querySelector('.chat-username-btn').addEventListener('click', (e) => {
    openModFlyout(meta.username || displayName, e);
  });

  viewport.appendChild(row);
  viewport.scrollTop = viewport.scrollHeight;
}

function escapeText(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

async function sendBroadcasterChatMessage(message) {
  if (APP_STATE.settings.simMode) {
    postChatMessage(APP_STATE.auth.displayName || 'Broadcaster', message, {
      isBroadcaster: true,
      color: '#9146ff'
    });
    return;
  }

  // If connected via IRC with authenticated token, send directly to socket
  if (APP_STATE.ircSocket && APP_STATE.ircSocket.readyState === WebSocket.OPEN && APP_STATE.auth.token && APP_STATE.auth.channel) {
    APP_STATE.ircSocket.send(`PRIVMSG #${APP_STATE.auth.channel} :${message}`);
    postChatMessage(APP_STATE.auth.displayName || APP_STATE.auth.username, message, {
      isBroadcaster: true,
      color: '#9146ff'
    });
    return;
  }

  // Otherwise try Helix REST API
  if (APP_STATE.auth.token && APP_STATE.auth.userId && APP_STATE.auth.clientId) {
    try {
      await fetch('https://api.twitch.tv/helix/chat/messages', {
        method: 'POST',
        headers: {
          'Client-Id': APP_STATE.auth.clientId,
          'Authorization': `Bearer ${APP_STATE.auth.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          broadcaster_id: APP_STATE.auth.userId,
          sender_id: APP_STATE.auth.userId,
          message
        })
      });
      postChatMessage(APP_STATE.auth.displayName || APP_STATE.auth.username, message, {
        isBroadcaster: true,
        color: '#9146ff'
      });
    } catch (e) {
      console.error('Send message failed:', e);
    }
  } else {
    triggerToast('Please connect your Twitch account to send messages.', 'warning');
  }
}

// ==========================================================================
// STUDIO ACTIONS (Instant Clip, Meta Updater, Chat Modes)
// ==========================================================================

async function triggerLiveClip() {
  audio.play('clip');
  triggerToast('✂️ Creating instant live stream clip...', 'info');

  const outBox = document.getElementById('clipOutputBox');
  const textEl = document.getElementById('clipUrlText');

  if (APP_STATE.settings.simMode || !APP_STATE.auth.token) {
    const mockUrl = `https://clips.twitch.tv/StreamPulse-${Math.floor(Math.random() * 899999 + 100000)}`;
    textEl.textContent = mockUrl;
    outBox.classList.remove('hidden');
    navigator.clipboard.writeText(mockUrl).then(() => {
      triggerToast('🎬 Clip Created! Copied link to clipboard.', 'success');
    });
    return;
  }

  try {
    const res = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${APP_STATE.auth.userId}`, {
      method: 'POST',
      headers: {
        'Client-Id': APP_STATE.auth.clientId,
        'Authorization': `Bearer ${APP_STATE.auth.token}`
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.data && data.data[0]) {
      const clip = data.data[0];
      textEl.textContent = clip.edit_url;
      outBox.classList.remove('hidden');
      navigator.clipboard.writeText(clip.edit_url);
      triggerToast('🎬 Clip Created! Copied link to clipboard.', 'success');
    }
  } catch (err) {
    triggerToast('Failed to create clip. Make sure stream is live.', 'error');
  }
}

// ==========================================================================
// REAL TWITCH STREAM INFO & CATEGORY PICKER ENGINE
// ==========================================================================

const TOP_TWITCH_CATEGORIES = [
  {
    id: '491487',
    name: 'Dead by Daylight',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/491487_IGDB-144x192.jpg',
    viewers: '12.4K Viewers',
    followers: '14M Followers',
    genres: ['Strategy', 'Action', 'Horror', 'Survival']
  },
  {
    id: '509658',
    name: 'Just Chatting',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/509658-144x192.jpg',
    viewers: '185K Viewers',
    followers: '26M Followers',
    genres: ['IRL', 'Discussion', 'Creative']
  },
  {
    id: '516575',
    name: 'Valorant',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-144x192.jpg',
    viewers: '94.2K Viewers',
    followers: '20M Followers',
    genres: ['Shooter', 'FPS', 'Tactical', 'Competitive']
  },
  {
    id: '512953',
    name: 'Elden Ring',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/512953_IGDB-144x192.jpg',
    viewers: '35.6K Viewers',
    followers: '9.8M Followers',
    genres: ['RPG', 'Action', 'Open World', 'Souls-like']
  },
  {
    id: '21779',
    name: 'League of Legends',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/21779-144x192.jpg',
    viewers: '140K Viewers',
    followers: '38M Followers',
    genres: ['MOBA', 'Strategy', 'Action', 'Competitive']
  },
  {
    id: '32982',
    name: 'Grand Theft Auto V',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/32982_IGDB-144x192.jpg',
    viewers: '120K Viewers',
    followers: '65M Followers',
    genres: ['Open World', 'Action', 'Adventure', 'Roleplay']
  },
  {
    id: '33214',
    name: 'Fortnite',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-144x192.jpg',
    viewers: '88K Viewers',
    followers: '90M Followers',
    genres: ['Shooter', 'Battle Royale', 'Action']
  },
  {
    id: '27471',
    name: 'Minecraft',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-144x192.jpg',
    viewers: '42K Viewers',
    followers: '52M Followers',
    genres: ['Adventure', 'Sandbox', 'Survival']
  },
  {
    id: '511224',
    name: 'Apex Legends',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/511224-144x192.jpg',
    viewers: '30K Viewers',
    followers: '24M Followers',
    genres: ['Shooter', 'FPS', 'Battle Royale']
  },
  {
    id: '515025',
    name: 'Overwatch 2',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/515025-144x192.jpg',
    viewers: '22K Viewers',
    followers: '16M Followers',
    genres: ['Shooter', 'FPS', 'Team-Based']
  },
  {
    id: '65876',
    name: 'Cyberpunk 2077',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/65876_IGDB-144x192.jpg',
    viewers: '15K Viewers',
    followers: '11M Followers',
    genres: ['RPG', 'Action', 'Open World']
  },
  {
    id: '1469308723',
    name: 'Software and Game Development',
    box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/1469308723-144x192.jpg',
    viewers: '4.8K Viewers',
    followers: '1.2M Followers',
    genres: ['Creative', 'Programming', 'Dev']
  }
];

function loadSavedCategory() {
  try {
    const raw = localStorage.getItem('sp_stream_category');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.name) return parsed;
    }
  } catch (e) {}
  return TOP_TWITCH_CATEGORIES[0];
}

function loadSavedTags() {
  try {
    const raw = localStorage.getItem('sp_stream_tags');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return ['ไทย', 'ภาษาไทย', 'TH'];
}

let streamTags = loadSavedTags();
let currentSelectedCategory = loadSavedCategory();

function setupStreamInfoManager() {
  const titleInput = document.getElementById('streamTitleInput');
  const titleCount = document.getElementById('titleCharCount');
  const notifInput = document.getElementById('goLiveNotificationInput');
  const notifCount = document.getElementById('notifCharCount');
  const langSelect = document.getElementById('streamLanguageSelect');

  // Load saved title, notif, language
  const savedTitle = localStorage.getItem('sp_stream_title');
  if (savedTitle !== null) titleInput.value = savedTitle;

  const savedNotif = localStorage.getItem('sp_stream_notif');
  if (savedNotif !== null) notifInput.value = savedNotif;

  const savedLang = localStorage.getItem('sp_stream_language');
  if (savedLang && langSelect) langSelect.value = savedLang;

  // Title character counter & auto-save
  function updateTitleCounter() {
    titleCount.textContent = `${titleInput.value.length}/140`;
  }
  titleInput.addEventListener('input', () => {
    updateTitleCounter();
    localStorage.setItem('sp_stream_title', titleInput.value);
  });
  updateTitleCounter();

  // Notification character counter & auto-save
  function updateNotifCounter() {
    notifCount.textContent = `${notifInput.value.length}/140`;
  }
  notifInput.addEventListener('input', () => {
    updateNotifCounter();
    localStorage.setItem('sp_stream_notif', notifInput.value);
  });
  updateNotifCounter();

  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      localStorage.setItem('sp_stream_language', e.target.value);
    });
  }

  // Category Selection UI
  const categoryCard = document.getElementById('selectedCategoryCard');
  const categorySearchWrap = document.getElementById('categorySearchWrapper');
  const categoryInput = document.getElementById('categorySearchInput');
  const dropdownResults = document.getElementById('categoryDropdownResults');
  const removeCatBtn = document.getElementById('removeCategoryBtn');
  const catSpinner = document.getElementById('catSearchSpinner');

  removeCatBtn.addEventListener('click', () => {
    categoryCard.classList.add('hidden');
    categorySearchWrap.classList.remove('hidden');
    categoryInput.value = '';
    categoryInput.focus();
    renderCategoryDropdown('');
  });

  categoryInput.addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    await renderCategoryDropdown(q);
  });

  categoryInput.addEventListener('focus', async () => {
    await renderCategoryDropdown(categoryInput.value.trim());
  });

  async function renderCategoryDropdown(query) {
    dropdownResults.classList.remove('hidden');
    dropdownResults.innerHTML = '';
    catSpinner.classList.remove('hidden');

    let results = [];

    // If online & has Twitch Token, search live Twitch Helix categories!
    if (query.length >= 2 && APP_STATE.auth.token && APP_STATE.auth.clientId) {
      try {
        const res = await fetch(`https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}`, {
          headers: {
            'Client-Id': APP_STATE.auth.clientId,
            'Authorization': `Bearer ${APP_STATE.auth.token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && data.data.length > 0) {
            results = data.data.map(item => ({
              id: item.id,
              name: item.name,
              box_art_url: item.box_art_url ? item.box_art_url.replace('{width}', '144').replace('{height}', '192') : 'https://static-cdn.jtvnw.net/ttv-boxart/509658-144x192.jpg',
              viewers: 'Live Category',
              followers: 'Twitch Directory',
              genres: ['Official Twitch Category']
            }));
          }
        }
      } catch (e) {
        console.warn('Twitch Category search failed, using catalogue:', e);
      }
    }

    catSpinner.classList.add('hidden');

    // Fallback or local filter
    if (results.length === 0) {
      if (!query) {
        results = TOP_TWITCH_CATEGORIES;
      } else {
        results = TOP_TWITCH_CATEGORIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
      }
    }

    if (results.length === 0) {
      dropdownResults.innerHTML = `
        <div style="padding: 12px; font-size: 0.78rem; color: var(--text-muted); text-align: center;">
          No categories found for "${escapeText(query)}"
        </div>
      `;
      return;
    }

    results.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'category-dropdown-item';
      item.innerHTML = `
        <img src="${cat.box_art_url}" alt="${cat.name}" class="dropdown-boxart">
        <div class="dropdown-item-info">
          <span class="dropdown-item-title">${cat.name}</span>
          <span class="dropdown-item-sub font-mono">${cat.viewers || ''} ${cat.followers ? '• ' + cat.followers : ''}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        applySelectedCategory(cat, true);
      });

      dropdownResults.appendChild(item);
    });
  }

  function applySelectedCategory(cat, playSound = false) {
    currentSelectedCategory = cat;
    APP_STATE.stream.game = cat.name;
    APP_STATE.stream.gameId = cat.id;

    localStorage.setItem('sp_stream_category', JSON.stringify(cat));

    document.getElementById('selectedCategoryImg').src = cat.box_art_url || 'https://static-cdn.jtvnw.net/ttv-boxart/509658-144x192.jpg';
    document.getElementById('selectedCategoryName').textContent = cat.name;
    document.getElementById('selectedCategoryMetrics').textContent = `${cat.viewers || 'Active'} • ${cat.followers || 'Twitch Directory'}`;

    const genresContainer = document.getElementById('selectedCategoryGenres');
    genresContainer.innerHTML = '';
    (cat.genres || ['Game']).forEach(g => {
      const chip = document.createElement('span');
      chip.className = 'genre-chip';
      chip.textContent = g;
      genresContainer.appendChild(chip);
    });

    categorySearchWrap.classList.add('hidden');
    dropdownResults.classList.add('hidden');
    categoryCard.classList.remove('hidden');

    if (playSound) audio.play('success');
  }

  // Apply initially loaded category
  applySelectedCategory(currentSelectedCategory, false);

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!categorySearchWrap.contains(e.target)) {
      dropdownResults.classList.add('hidden');
    }
  });

  // Tags Manager
  const tagsListEl = document.getElementById('tagsChipsList');
  const tagCountEl = document.getElementById('tagCountDisplay');
  const newTagInput = document.getElementById('newTagInput');
  const addTagBtn = document.getElementById('addTagBtn');

  function renderTags() {
    tagsListEl.innerHTML = '';
    tagCountEl.textContent = `${streamTags.length}/10`;

    streamTags.forEach(t => {
      const chip = document.createElement('span');
      chip.className = 'stream-tag-chip';
      chip.innerHTML = `${escapeText(t)} <button type="button" class="remove-tag" data-tag="${escapeText(t)}">✕</button>`;
      
      chip.querySelector('.remove-tag').addEventListener('click', () => {
        streamTags = streamTags.filter(item => item !== t);
        localStorage.setItem('sp_stream_tags', JSON.stringify(streamTags));
        renderTags();
      });

      tagsListEl.appendChild(chip);
    });
  }

  function addCurrentTag() {
    const val = newTagInput.value.trim().replace(/,/g, '');
    if (val && streamTags.length < 10 && !streamTags.includes(val)) {
      streamTags.push(val);
      localStorage.setItem('sp_stream_tags', JSON.stringify(streamTags));
      newTagInput.value = '';
      renderTags();
    }
  }

  addTagBtn.addEventListener('click', addCurrentTag);
  newTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCurrentTag();
    }
  });

  renderTags();

  // Save to Twitch button
  document.getElementById('updateChannelBtn').addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const lang = langSelect ? langSelect.value : 'th';
    const game = currentSelectedCategory ? currentSelectedCategory.name : 'Just Chatting';
    const gameId = currentSelectedCategory ? currentSelectedCategory.id : '509658';

    APP_STATE.stream.title = title;
    APP_STATE.stream.game = game;
    APP_STATE.stream.gameId = gameId;

    localStorage.setItem('sp_stream_title', title);
    localStorage.setItem('sp_stream_notif', notifInput.value);
    localStorage.setItem('sp_stream_language', lang);
    localStorage.setItem('sp_stream_category', JSON.stringify(currentSelectedCategory));
    localStorage.setItem('sp_stream_tags', JSON.stringify(streamTags));

    if (APP_STATE.settings.simMode || !APP_STATE.auth.token || !APP_STATE.auth.userId) {
      audio.play('success');
      triggerToast(`Saved stream info: "${game}" | ${title.slice(0, 30)}...`, 'success');
      return;
    }

    try {
      const res = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${APP_STATE.auth.userId}`, {
        method: 'PATCH',
        headers: {
          'Client-Id': APP_STATE.auth.clientId,
          'Authorization': `Bearer ${APP_STATE.auth.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          game_id: gameId,
          broadcaster_language: lang,
          tags: streamTags
        })
      });

      if (res.ok) {
        audio.play('success');
        triggerToast('✅ Twitch Stream Info updated successfully!', 'success');
      } else {
        const err = await res.json();
        triggerToast(`Twitch API error: ${err.message || res.status}`, 'warning');
      }
    } catch (e) {
      console.error('Failed to update channel info:', e);
      triggerToast('Failed to update Twitch metadata. Check connection.', 'error');
    }
  });
}

// ==========================================================================
// CHAT SAFETY MODES & MODERATION ENGINE (Twitch Helix + IRC Commands)
// ==========================================================================

async function syncChatSettingsFromTwitch() {
  if (!APP_STATE.auth.token || !APP_STATE.auth.userId || !APP_STATE.auth.clientId) return;

  try {
    const res = await fetch(`https://api.twitch.tv/helix/chat/settings?broadcaster_id=${APP_STATE.auth.userId}&moderator_id=${APP_STATE.auth.userId}`, {
      headers: {
        'Client-Id': APP_STATE.auth.clientId,
        'Authorization': `Bearer ${APP_STATE.auth.token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data[0]) {
        const s = data.data[0];
        APP_STATE.modes.emote = !!s.emote_mode;
        APP_STATE.modes.sub = !!s.subscriber_mode;
        APP_STATE.modes.followers = !!s.follower_mode;
        APP_STATE.modes.slow = !!s.slow_mode;

        updateChatModeUI('emote');
        updateChatModeUI('sub');
        updateChatModeUI('followers');
        updateChatModeUI('slow');
      }
    }
  } catch (e) {
    console.warn('Could not sync chat settings from Twitch:', e);
  }
}

function updateChatModeUI(key) {
  const btn = document.querySelector(`.mode-toggle-card[data-mode="${key}"]`);
  if (!btn) return;
  const label = btn.querySelector('.mode-switch-state');

  if (APP_STATE.modes[key]) {
    btn.classList.add('active');
    if (label) label.textContent = 'ON';
  } else {
    btn.classList.remove('active');
    if (label) label.textContent = 'OFF';
  }
}

async function toggleChatSafetyMode(key) {
  APP_STATE.modes[key] = !APP_STATE.modes[key];
  const isEnabled = APP_STATE.modes[key];
  localStorage.setItem('sp_mode_' + key, isEnabled);
  updateChatModeUI(key);
  audio.play('success');

  const modeNames = {
    emote: 'Emote-Only',
    sub: 'Subscribers-Only',
    followers: 'Followers-Only',
    slow: 'Slow Mode (5s)'
  };

  const name = modeNames[key] || key;

  // 1. If in Simulator Mode
  if (APP_STATE.settings.simMode) {
    triggerToast(`${name} ${isEnabled ? 'ENABLED' : 'DISABLED'}`, 'info');
    return;
  }

  // 2. Call Twitch Helix PATCH /helix/chat/settings
  let helixSuccess = false;
  if (APP_STATE.auth.token && APP_STATE.auth.userId && APP_STATE.auth.clientId) {
    try {
      const payload = {};
      if (key === 'emote') payload.emote_mode = isEnabled;
      else if (key === 'sub') payload.subscriber_mode = isEnabled;
      else if (key === 'followers') {
        payload.follower_mode = isEnabled;
        if (isEnabled) payload.follower_mode_duration = 0;
      } else if (key === 'slow') {
        payload.slow_mode = isEnabled;
        if (isEnabled) payload.slow_mode_wait_time = 5;
      }

      const res = await fetch(`https://api.twitch.tv/helix/chat/settings?broadcaster_id=${APP_STATE.auth.userId}&moderator_id=${APP_STATE.auth.userId}`, {
        method: 'PATCH',
        headers: {
          'Client-Id': APP_STATE.auth.clientId,
          'Authorization': `Bearer ${APP_STATE.auth.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        helixSuccess = true;
        triggerToast(`🛡️ Twitch ${name}: ${isEnabled ? 'ON' : 'OFF'}`, 'success');
      }
    } catch (e) {
      console.warn('Helix chat settings update error:', e);
    }
  }

  // 3. Fallback to Twitch Chat Bot Commands
  if (!helixSuccess) {
    let cmd = '';
    if (key === 'emote') cmd = isEnabled ? '/emoteonly' : '/emoteonlyoff';
    else if (key === 'sub') cmd = isEnabled ? '/subscribers' : '/subscribersoff';
    else if (key === 'followers') cmd = isEnabled ? '/followers 0' : '/followersoff';
    else if (key === 'slow') cmd = isEnabled ? '/slow 5' : '/slowoff';

    if (cmd) {
      sendBroadcasterChatMessage(cmd);
      triggerToast(`🛡️ Sent ${cmd} to chat (${name}: ${isEnabled ? 'ON' : 'OFF'})`, 'success');
    }
  }
}

async function nukeLiveChat() {
  audio.play('alert');

  // 1. Call Twitch Helix DELETE /helix/moderation/chat
  if (APP_STATE.auth.token && APP_STATE.auth.userId && APP_STATE.auth.clientId) {
    try {
      await fetch(`https://api.twitch.tv/helix/moderation/chat?broadcaster_id=${APP_STATE.auth.userId}&moderator_id=${APP_STATE.auth.userId}`, {
        method: 'DELETE',
        headers: {
          'Client-Id': APP_STATE.auth.clientId,
          'Authorization': `Bearer ${APP_STATE.auth.token}`
        }
      });
    } catch (e) {
      console.warn('Helix clear chat error:', e);
    }
  }

  // 2. Fallback /clear command to chat
  sendBroadcasterChatMessage('/clear');

  // 3. Clear local chat container
  const scroll = document.getElementById('chatStreamScroll');
  if (scroll) {
    scroll.innerHTML = `
      <div style="padding: 12px; font-size: 0.78rem; color: var(--crimson-alert); text-align: center; font-family: var(--font-mono); background: rgba(239, 68, 68, 0.08); border-radius: var(--radius-sm); margin: 8px 0;">
        🧹 Chat was cleared by broadcaster.
      </div>
    `;
  }

  triggerToast('🧹 Live chat has been cleared / nuked.', 'warning');
}

// ==========================================================================
// BROADCAST CHAT MACROS MANAGER & ENGINE
// ==========================================================================

function saveMacros(list) {
  APP_STATE.macros = list;
  localStorage.setItem('sp_chat_macros', JSON.stringify(list));
  renderChatMacros();
}

function renderChatMacros() {
  const container = document.getElementById('macrosMatrixContainer');
  const dockGrid = document.getElementById('dockMacrosGrid');

  if (container) {
    container.innerHTML = '';
    APP_STATE.macros.forEach(macro => {
      const btn = document.createElement('button');
      btn.className = 'macro-tile';
      btn.setAttribute('data-msg', macro.message);
      btn.innerHTML = `
        <div class="macro-badge font-mono">${escapeText(macro.cmd)}</div>
        <span class="macro-desc" title="${escapeText(macro.label)}: ${escapeText(macro.message)}">${escapeText(macro.label)}</span>
      `;

      btn.addEventListener('click', () => {
        sendBroadcasterChatMessage(macro.message);
        triggerToast(`📢 Broadcasted [${macro.cmd}] to chat!`, 'success');
        audio.play('success');
      });

      container.appendChild(btn);
    });
  }

  if (dockGrid) {
    dockGrid.innerHTML = '';
    APP_STATE.macros.forEach(macro => {
      const btn = document.createElement('button');
      btn.className = 'dock-macro-btn';
      btn.innerHTML = `
        <span class="dock-macro-cmd">${escapeText(macro.cmd)}</span>
        <span class="dock-macro-lbl" title="${escapeText(macro.label)}: ${escapeText(macro.message)}">${escapeText(macro.label)}</span>
      `;

      btn.addEventListener('click', () => {
        sendBroadcasterChatMessage(macro.message);
        triggerToast(`📢 Broadcasted [${macro.cmd}] to chat!`, 'success');
        audio.play('success');
      });

      dockGrid.appendChild(btn);
    });
  }
}

// Live Cross-Window Synchronization (OBS Dock ⇄ Web Dashboard)
window.addEventListener('storage', (e) => {
  if (e.key === 'sp_chat_macros') {
    APP_STATE.macros = loadSavedMacros();
    renderChatMacros();
  }
  if (e.key === 'sp_chat_favs') {
    APP_STATE.favorites = loadSavedFavorites();
    renderFavorites();
  }
  if (e.key && e.key.startsWith('sp_mode_')) {
    const key = e.key.replace('sp_mode_', '');
    APP_STATE.modes[key] = e.newValue === 'true';
    updateChatModeUI(key);
  }
  if (e.key === 'sp_so_template' && e.newValue) {
    APP_STATE.settings.shoutoutTemplate = e.newValue;
  }
});

function saveFavorites(list) {
  APP_STATE.favorites = list;
  localStorage.setItem('sp_chat_favs', JSON.stringify(list));
  renderFavorites();
}

function renderFavorites() {
  const dashStrip = document.getElementById('favoritesStrip');
  const dockStrip = document.getElementById('dockFavoritesStrip');

  const renderToStrip = (strip, isDock) => {
    if (!strip) return;
    strip.innerHTML = '';
    
    if (APP_STATE.favorites.length === 0) {
      strip.innerHTML = `<span style="color: var(--text-muted); font-size: 0.8rem; padding: 4px 0;">No favorites added. Use the ⭐ button next to the Shoutout input!</span>`;
      return;
    }

    APP_STATE.favorites.forEach(fav => {
      const chip = document.createElement('div');
      chip.style.cssText = `
        display: inline-flex; align-items: center; gap: 6px; 
        background: var(--surface-3); border: 1px solid var(--border-color); 
        padding: 4px 10px; border-radius: 12px; font-size: 0.85rem;
        cursor: pointer; transition: all 0.2s; user-select: none;
      `;
      chip.innerHTML = `
        <span style="color: var(--purple-accent); font-weight: 500;">@${escapeText(fav)}</span>
        <button class="remove-fav-btn" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0 4px; font-size: 0.9rem; line-height: 1;">✕</button>
      `;

      // Click name to shoutout
      chip.querySelector('span').addEventListener('click', () => {
        sendTwitchShoutout(fav);
        if (isDock) {
          const input = document.getElementById('dockManualInput');
          if (input) input.value = '';
        } else {
          const input = document.getElementById('manualShoutoutInput');
          if (input) input.value = '';
        }
      });

      // Click X to remove
      chip.querySelector('.remove-fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const newList = APP_STATE.favorites.filter(f => f !== fav);
        saveFavorites(newList);
        triggerToast(`Removed @${fav} from favorites. Copy Dock URL to sync!`, 'info');
      });

      strip.appendChild(chip);
    });
  };

  renderToStrip(dashStrip, false);
  renderToStrip(dockStrip, true);
}

function setupMacrosManager() {
  const modal = document.getElementById('macrosModal');
  const openBtn = document.getElementById('manageMacrosBtn');
  const closeBtn = document.getElementById('closeMacrosModalBtn');
  const listContainer = document.getElementById('macroEditorList');
  const cmdInput = document.getElementById('newMacroCommand');
  const labelInput = document.getElementById('newMacroLabel');
  const msgInput = document.getElementById('newMacroMessage');
  const addBtn = document.getElementById('addNewMacroBtn');
  const resetBtn = document.getElementById('resetMacrosDefaultBtn');
  const saveBtn = document.getElementById('saveMacrosModalBtn');

  let workingMacros = JSON.parse(JSON.stringify(APP_STATE.macros));

  function renderEditorList() {
    listContainer.innerHTML = '';

    if (workingMacros.length === 0) {
      listContainer.innerHTML = `<div style="padding: 12px; font-size: 0.78rem; color: var(--text-muted); text-align: center;">No custom macros yet. Add one below!</div>`;
      return;
    }

    workingMacros.forEach((macro, idx) => {
      const row = document.createElement('div');
      row.className = 'macro-editor-item';
      row.innerHTML = `
        <div class="macro-item-left">
          <div class="macro-item-head">
            <span class="macro-item-cmd">${escapeText(macro.cmd)}</span>
            <span class="macro-item-title">${escapeText(macro.label)}</span>
          </div>
          <span class="macro-item-msg" title="${escapeText(macro.message)}">${escapeText(macro.message)}</span>
        </div>
        <div class="macro-item-actions">
          <button class="btn-del-macro" title="Delete Macro" data-idx="${idx}" aria-label="Delete macro">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      row.querySelector('.btn-del-macro').addEventListener('click', () => {
        workingMacros.splice(idx, 1);
        renderEditorList();
      });

      listContainer.appendChild(row);
    });
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      workingMacros = JSON.parse(JSON.stringify(APP_STATE.macros));
      renderEditorList();
      modal.classList.remove('hidden');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      let cmd = cmdInput.value.trim();
      const label = labelInput.value.trim();
      const msg = msgInput.value.trim();

      if (!cmd || !msg) {
        triggerToast('Please provide a command badge and message.', 'warning');
        return;
      }

      if (!cmd.startsWith('!')) cmd = '!' + cmd;

      workingMacros.push({
        id: String(Date.now()),
        cmd,
        label: label || cmd,
        message: msg
      });

      cmdInput.value = '';
      labelInput.value = '';
      msgInput.value = '';
      renderEditorList();
      triggerToast(`Added ${cmd} to list. Click "Save & Apply" to confirm.`, 'info');
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      workingMacros = JSON.parse(JSON.stringify(DEFAULT_MACROS));
      renderEditorList();
      triggerToast('Reset to default macros.', 'info');
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveMacros(workingMacros);
      modal.classList.add('hidden');
      triggerToast('💬 Broadcast Chat Macros updated! To sync to OBS, copy the Dock URL again.', 'success');
    });
  }

  renderChatMacros();
}

// ==========================================================================
// QUICK MOD FLYOUT
// ==========================================================================

let selectedFlyoutUser = null;

function openModFlyout(username, e) {
  selectedFlyoutUser = username;
  const flyout = document.getElementById('quickModFlyout');
  document.getElementById('flyoutUsername').textContent = `@${username}`;

  flyout.style.left = `${Math.min(e.clientX + 10, window.innerWidth - 240)}px`;
  flyout.style.top = `${Math.min(e.clientY - 10, window.innerHeight - 220)}px`;
  flyout.classList.remove('hidden');
}

function closeModFlyout() {
  document.getElementById('quickModFlyout').classList.add('hidden');
  selectedFlyoutUser = null;
}

// ==========================================================================
// SIMULATOR ENGINE (Zero-Config Test Data)
// ==========================================================================

const SIMULATED_DATA = [
  { username: 'valkyrie_pro', displayName: 'ValkyriePro', color: '#ff2a6d', game: 'Valorant', isStreamer: true, isVip: true, msg: 'Insane clutch in that last round! What rank are we aiming for today?' },
  { username: 'shadowblade', displayName: 'ShadowBlade', color: '#00f0ff', game: 'Elden Ring', isStreamer: true, isMod: true, msg: 'Hype in the chat for the next boss run!' },
  { username: 'pixelartist', displayName: 'PixelArtist', color: '#10b981', game: 'Software and Game Development', isStreamer: true, isVip: false, msg: 'Just wrapped up my art stream, sending love and raids your way!' },
  { username: 'neonrider', displayName: 'NeonRider', color: '#d946ef', game: 'Cyberpunk 2077', isStreamer: true, isVip: true, msg: 'Audio and stream quality are 10/10 today 🔥' },
  { username: 'chillvibes', displayName: 'ChillVibes', color: '#f59e0b', game: 'Just Chatting', isStreamer: false, isMod: false, msg: 'LURK ACTIVATED coffee & work time ☕' },
  { username: 'arcadeking', displayName: 'ArcadeKing', color: '#38bdf8', game: 'Street Fighter 6', isStreamer: true, isVip: false, msg: 'Ready for community games later?' }
];

function loadSimulatedStreamers() {
  SIMULATED_DATA.forEach((s, idx) => {
    setTimeout(() => {
      indexChatter(s.username, s.displayName, s.msg, {
        color: s.color,
        isStreamer: s.isStreamer,
        isVip: s.isVip,
        isMod: s.isMod,
        lastGame: s.game
      });

      postChatMessage(s.displayName, s.msg, {
        color: s.color,
        isMod: s.isMod,
        isVip: s.isVip,
        username: s.username
      });
    }, idx * 350);
  });

  triggerToast('Simulated creators & live chatters loaded!', 'success');
}

// ==========================================================================
// INITIALIZATION & EVENT BINDINGS
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  processOAuthCallback();
  syncAuthView();
  updateDiagnosticsUI();

  // Redirect URI display in modal
  const uriEl = document.getElementById('redirectUriDisplay');
  if (uriEl) uriEl.textContent = getRedirectUrl();

  const clientIdField = document.getElementById('twitchClientIdField');
  if (clientIdField) clientIdField.value = APP_STATE.auth.clientId;
  
  const targetChannelField = document.getElementById('targetChannelField');
  if (targetChannelField) targetChannelField.value = APP_STATE.auth.channel;
  
  const quickChannelInput = document.getElementById('quickChannelInput');
  if (quickChannelInput) quickChannelInput.value = APP_STATE.auth.channel || DEFAULT_CHANNEL;

  // Validate stored token or connect IRC on startup
  if (APP_STATE.auth.token) {
    validateAndLoadToken();
  } else if (!APP_STATE.settings.simMode) {
    connectToTwitchChannel(APP_STATE.auth.channel || DEFAULT_CHANNEL);
  }

  // Initialize Real Twitch Stream Info & Category Picker
  setupStreamInfoManager();

  // Initialize Broadcast Chat Macros Manager
  setupMacrosManager();

  // Quick Channel Joiner
  const quickJoinBtn = document.getElementById('quickJoinBtn');
  if (quickJoinBtn && quickChannelInput) {
    quickJoinBtn.addEventListener('click', () => {
      const ch = quickChannelInput.value.trim();
      if (ch) {
        APP_STATE.settings.simMode = false;
        localStorage.setItem('sp_sim_mode', 'false');
        const simModeToggle = document.getElementById('simModeToggle');
        if (simModeToggle) simModeToggle.classList.remove('active');
        const simModeLabel = document.getElementById('simModeLabel');
        if (simModeLabel) simModeLabel.textContent = 'LIVE API MODE';
        connectToTwitchChannel(ch);
      }
    });

    quickChannelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const ch = e.target.value.trim();
        if (ch) {
          APP_STATE.settings.simMode = false;
          localStorage.setItem('sp_sim_mode', 'false');
          const simModeToggle = document.getElementById('simModeToggle');
          if (simModeToggle) simModeToggle.classList.remove('active');
          const simModeLabel = document.getElementById('simModeLabel');
          if (simModeLabel) simModeLabel.textContent = 'LIVE API MODE';
          connectToTwitchChannel(ch);
        }
      }
    });
  }

  // Simulator Toggle
  const simToggle = document.getElementById('simModeToggle');
  if (simToggle) {
    simToggle.classList.toggle('active', APP_STATE.settings.simMode);
    document.getElementById('simModeLabel').textContent = APP_STATE.settings.simMode ? 'SIMULATOR ACTIVE' : 'LIVE API MODE';
    
    simToggle.addEventListener('click', () => {
      APP_STATE.settings.simMode = !APP_STATE.settings.simMode;
      localStorage.setItem('sp_sim_mode', APP_STATE.settings.simMode);
      simToggle.classList.toggle('active', APP_STATE.settings.simMode);
      document.getElementById('simModeLabel').textContent = APP_STATE.settings.simMode ? 'SIMULATOR ACTIVE' : 'LIVE API MODE';
      updateDiagnosticsUI();

      if (APP_STATE.settings.simMode) {
        loadSimulatedStreamers();
        triggerToast('Switched to Demo Simulator Mode', 'info');
      } else {
        APP_STATE.chatters.clear();
        document.getElementById('chatterCountBadge').textContent = '0';
        refreshChattersDeck();
        connectToTwitchChannel(APP_STATE.auth.channel || DEFAULT_CHANNEL);
        triggerToast('Switched to Live API Mode', 'info');
      }
    });
  }

  // Sound Feedback Toggle
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      APP_STATE.settings.soundEnabled = !APP_STATE.settings.soundEnabled;
      localStorage.setItem('sp_sound', APP_STATE.settings.soundEnabled);
      soundBtn.classList.toggle('active', APP_STATE.settings.soundEnabled);
      const iconSoundOn = document.querySelector('.icon-sound-on');
      const iconSoundOff = document.querySelector('.icon-sound-off');
      if (iconSoundOn) iconSoundOn.classList.toggle('hidden', !APP_STATE.settings.soundEnabled);
      if (iconSoundOff) iconSoundOff.classList.toggle('hidden', APP_STATE.settings.soundEnabled);
      triggerToast(`Audio Effects: ${APP_STATE.settings.soundEnabled ? 'ON' : 'OFF'}`, 'info');
    });
  }

  // Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
  if (settingsModal && openSettingsBtn && closeSettingsModalBtn) {
    openSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
  }

  // copyRedirectBtn removed from simplified UI — guard in case it exists
  const copyRedirectBtn = document.getElementById('copyRedirectBtn');
  if (copyRedirectBtn) {
    copyRedirectBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(getRedirectUrl());
      triggerToast('Redirect URL copied to clipboard!', 'success');
    });
  }

  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      // Client ID always bundled — only save channel override and direct token
      const targetChannelField = document.getElementById('targetChannelField');
      const ch = (targetChannelField ? targetChannelField.value.trim() : '') || DEFAULT_CHANNEL;
      const twitchDirectTokenField = document.getElementById('twitchDirectTokenField');
      const directToken = twitchDirectTokenField ? twitchDirectTokenField.value.trim() : '';

      APP_STATE.auth.channel = ch;
      localStorage.setItem('sp_twitch_channel', ch);

      if (directToken) {
        APP_STATE.auth.token = directToken.replace(/^oauth:/, '');
        localStorage.setItem('sp_twitch_token', APP_STATE.auth.token);
        validateAndLoadToken();
      } else if (ch) {
        connectToTwitchChannel(ch);
      }

      if (settingsModal) settingsModal.classList.add('hidden');
      triggerToast('Settings applied.', 'success');
    });
  }

  const launchOAuthBtn = document.getElementById('launchOAuthBtn');
  if (launchOAuthBtn) launchOAuthBtn.addEventListener('click', startTwitchOAuth);
  
  const connectTwitchBtn = document.getElementById('connectTwitchBtn');
  if (connectTwitchBtn) {
    connectTwitchBtn.addEventListener('click', () => {
      // If client ID is already set, launch OAuth directly!
      startTwitchOAuth();
    });
  }

  const disconnectBtn = document.getElementById('disconnectBtn');
  if (disconnectBtn) disconnectBtn.addEventListener('click', handleDisconnect);

  // OBS Custom Browser Dock Modal
  const obsDockModal = document.getElementById('obsDockModal');
  const openObsDockBtn = document.getElementById('openObsDockBtn');
  const closeObsDockModalBtn = document.getElementById('closeObsDockModalBtn');
  const closeObsDockModalConfirmBtn = document.getElementById('closeObsDockModalConfirmBtn');
  const copyObsDockUrlBtn = document.getElementById('copyObsDockUrlBtn');

  // Build dock URL — embed auth token so OBS browser auto-logs in
  // Token goes in the URL hash fragment (never sent to server, safe)
  function buildDockUrl() {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'dock.html';
    const token   = APP_STATE.auth.token;
    const clientId = APP_STATE.auth.clientId || DEFAULT_CLIENT_ID;
    const channel  = APP_STATE.auth.channel || APP_STATE.auth.username || '';
    
    // Compress and encode macros so they sync to OBS dock
    const macrosJson = JSON.stringify(APP_STATE.macros);
    const macrosEncoded = btoa(encodeURIComponent(macrosJson));

    // Encode favorites
    const favsJson = JSON.stringify(APP_STATE.favorites);
    const favsEncoded = btoa(encodeURIComponent(favsJson));

    if (token) {
      // Encode as hash params: dock.html#t=TOKEN&c=CLIENTID&ch=CHANNEL&m=MACROS&f=FAVS
      return `${base}#t=${encodeURIComponent(token)}&c=${encodeURIComponent(clientId)}&ch=${encodeURIComponent(channel)}&m=${macrosEncoded}&f=${favsEncoded}`;
    }
    return base;
  }

  function refreshDockUrlDisplay() {
    const url = buildDockUrl();
    const dockDisplay = document.getElementById('obsDockUrlDisplay');
    if (dockDisplay) dockDisplay.textContent = url;
    const openDockNewTabBtn = document.getElementById('openDockNewTabBtn');
    if (openDockNewTabBtn) openDockNewTabBtn.href = url;
    return url;
  }

  refreshDockUrlDisplay();

  if (openObsDockBtn) openObsDockBtn.addEventListener('click', () => {
    refreshDockUrlDisplay(); // Always refresh token in URL when modal opens
    obsDockModal.classList.remove('hidden');
  });
  if (closeObsDockModalBtn) closeObsDockModalBtn.addEventListener('click', () => obsDockModal.classList.add('hidden'));
  if (closeObsDockModalConfirmBtn) closeObsDockModalConfirmBtn.addEventListener('click', () => obsDockModal.classList.add('hidden'));

  if (copyObsDockUrlBtn) {
    copyObsDockUrlBtn.addEventListener('click', () => {
      const url = refreshDockUrlDisplay();
      navigator.clipboard.writeText(url);
      triggerToast('📋 OBS Dock URL copied! Auth token included — paste into OBS.', 'success');
    });
  }

  // Template Modal
  const templateModal = document.getElementById('templateModal');
  const templateTextarea = document.getElementById('templateEditorTextarea');
  const templatePreview = document.getElementById('templatePreviewBox');

  function refreshTemplatePreview() {
    if (!templatePreview || !templateTextarea) return;
    templatePreview.textContent = templateTextarea.value
      .replace(/{username}/g, 'ValkyriePro')
      .replace(/{game}/g, 'Valorant')
      .replace(/{url}/g, 'https://twitch.tv/ValkyriePro');
  }

  if (templateTextarea && templateModal) {
    templateTextarea.value = APP_STATE.settings.shoutoutTemplate;
    refreshTemplatePreview();
    templateTextarea.addEventListener('input', refreshTemplatePreview);

    document.getElementById('editTemplateBtn').addEventListener('click', () => templateModal.classList.remove('hidden'));
    document.getElementById('closeTemplateModalBtn').addEventListener('click', () => templateModal.classList.add('hidden'));

    document.querySelectorAll('.tag-chip').forEach(tag => {
      tag.addEventListener('click', () => {
        templateTextarea.value += ' ' + tag.getAttribute('data-tag');
        refreshTemplatePreview();
      });
    });

    document.getElementById('saveTemplateBtn').addEventListener('click', () => {
      APP_STATE.settings.shoutoutTemplate = templateTextarea.value;
      localStorage.setItem('sp_so_template', templateTextarea.value);
      templateModal.classList.add('hidden');
      triggerToast('Shoutout template updated!', 'success');
    });

    document.getElementById('resetTemplateBtn').addEventListener('click', () => {
      templateTextarea.value = '⭐ Check out @{username} at https://twitch.tv/{username} ! They were last streaming {game} — give them a follow! 💜';
      refreshTemplatePreview();
    });
  }

  // Manual Shoutout
  const manualInput = document.getElementById('manualShoutoutInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  let avatarDebounceTimer = null;
  const processAvatarSearch = async (input, imgEl, iconEl) => {
    const val = input.value.trim().replace(/^@/, '');
    if (!val) {
      if (imgEl) imgEl.style.display = 'none';
      if (iconEl) iconEl.style.display = 'block';
      return;
    }
    
    clearTimeout(avatarDebounceTimer);
    avatarDebounceTimer = setTimeout(async () => {
      const user = await fetchTwitchUserProfile(val);
      if (user && user.profile_image_url) {
        if (imgEl) {
          imgEl.src = user.profile_image_url;
          imgEl.style.display = 'block';
        }
        if (iconEl) iconEl.style.display = 'none';
      } else {
        if (imgEl) imgEl.style.display = 'none';
        if (iconEl) iconEl.style.display = 'block';
      }
    }, 400);
  };

  if (manualInput && clearSearchBtn) {
    const imgEl = document.getElementById('shoutoutAvatarImg');
    const iconEl = document.getElementById('shoutoutSearchIcon');
    
    manualInput.addEventListener('input', () => {
      clearSearchBtn.classList.toggle('hidden', !manualInput.value);
      processAvatarSearch(manualInput, imgEl, iconEl);
    });

    clearSearchBtn.addEventListener('click', () => {
      manualInput.value = '';
      clearSearchBtn.classList.add('hidden');
      if (imgEl) imgEl.style.display = 'none';
      if (iconEl) iconEl.style.display = 'block';
      manualInput.focus();
    });

    const addFavoriteBtn = document.getElementById('addFavoriteBtn');
    if (addFavoriteBtn) {
      addFavoriteBtn.addEventListener('click', () => {
        const u = manualInput.value.trim().replace(/^@/, '');
        if (u) {
          if (!APP_STATE.favorites.includes(u)) {
            const newList = [...APP_STATE.favorites, u];
            saveFavorites(newList);
            triggerToast(`⭐ Added @${u} to favorites! Copy Dock URL to sync!`, 'success');
          } else {
            triggerToast(`@${u} is already in your favorites!`, 'info');
          }
          manualInput.value = '';
          clearSearchBtn.classList.add('hidden');
          if (imgEl) imgEl.style.display = 'none';
          if (iconEl) iconEl.style.display = 'block';
        }
      });
    }

    const manualShoutoutBtn = document.getElementById('manualShoutoutBtn');
    if (manualShoutoutBtn) {
      manualShoutoutBtn.addEventListener('click', () => {
        const u = manualInput.value.trim();
        if (u) {
          sendTwitchShoutout(u);
          manualInput.value = '';
          clearSearchBtn.classList.add('hidden');
          if (imgEl) imgEl.style.display = 'none';
          if (iconEl) iconEl.style.display = 'block';
        }
      });
    }

    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const u = e.target.value.trim();
        if (u) {
          sendTwitchShoutout(u);
          manualInput.value = '';
          clearSearchBtn.classList.add('hidden');
          if (imgEl) imgEl.style.display = 'none';
          if (iconEl) iconEl.style.display = 'block';
        }
      }
    });
  }

  // Filter Tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    const f = tab.getAttribute('data-filter');
    tab.classList.toggle('active', f === APP_STATE.settings.activeFilter);
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      APP_STATE.settings.activeFilter = f;
      localStorage.setItem('sp_active_filter', f);
      refreshChattersDeck();
    });
  });

  // Post chat toggle
  const postChatToggle = document.getElementById('postChatToggle');
  if (postChatToggle) {
    postChatToggle.checked = APP_STATE.settings.postChat;
    postChatToggle.addEventListener('change', (e) => {
      APP_STATE.settings.postChat = e.target.checked;
      localStorage.setItem('sp_post_chat', e.target.checked);
    });
  }

  const clearDeckBtn = document.getElementById('clearDeckBtn');
  if (clearDeckBtn) {
    clearDeckBtn.addEventListener('click', () => {
      APP_STATE.chatters.clear();
      document.getElementById('chatterCountBadge').textContent = '0';
      refreshChattersDeck();
      triggerToast('Chatter deck cleared.', 'info');
    });
  }

  // Stream Deck Actions
  const createClipBtn = document.getElementById('createClipBtn');
  if (createClipBtn) createClipBtn.addEventListener('click', triggerLiveClip);
  
  const copyClipUrlBtn = document.getElementById('copyClipUrlBtn');
  if (copyClipUrlBtn) {
    copyClipUrlBtn.addEventListener('click', () => {
      const url = document.getElementById('clipUrlText').textContent;
      navigator.clipboard.writeText(url);
      triggerToast('Clip URL copied!', 'success');
    });
  }

  // Chat Safety Modes: Restore visual states and attach listeners
  updateChatModeUI('emote');
  updateChatModeUI('sub');
  updateChatModeUI('followers');
  updateChatModeUI('slow');

  document.querySelectorAll('.mode-toggle-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const modeKey = btn.getAttribute('data-mode');
      toggleChatSafetyMode(modeKey);
    });
  });

  // Nuke / Clear Live Chat Button
  const clearChatBtn = document.getElementById('clearChatBtn');
  if (clearChatBtn) clearChatBtn.addEventListener('click', nukeLiveChat);

  // Broadcaster Chat Composer
  const chatComposerForm = document.getElementById('chatComposerForm');
  if (chatComposerForm) {
    chatComposerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('broadcasterChatInput');
      const msg = input.value.trim();
      if (msg) {
        sendBroadcasterChatMessage(msg);
        input.value = '';
      }
    });
  }

  // Mod Flyout
  const closeFlyoutBtn = document.getElementById('closeFlyoutBtn');
  if (closeFlyoutBtn) closeFlyoutBtn.addEventListener('click', closeModFlyout);
  
  const flyoutShoutoutBtn = document.getElementById('flyoutShoutoutBtn');
  if (flyoutShoutoutBtn) {
    flyoutShoutoutBtn.addEventListener('click', () => {
      if (selectedFlyoutUser) {
        sendTwitchShoutout(selectedFlyoutUser);
        closeModFlyout();
      }
    });
  }

  document.querySelectorAll('.flyout-grid-btn').forEach(b => {
    b.addEventListener('click', () => {
      const duration = b.getAttribute('data-time');
      triggerToast(`Timed out @${selectedFlyoutUser} for ${duration}s`, 'warning');
      closeModFlyout();
    });
  });

  const flyoutBanBtn = document.getElementById('flyoutBanBtn');
  if (flyoutBanBtn) {
    flyoutBanBtn.addEventListener('click', () => {
      triggerToast(`Banned user @${selectedFlyoutUser}`, 'error');
      closeModFlyout();
    });
  }

  const dockFavBtn = document.getElementById('dockFavBtn');
  if (dockFavBtn) {
    dockFavBtn.addEventListener('click', () => {
      const manInput = document.getElementById('dockManualInput');
      const u = manInput ? manInput.value.trim().replace(/^@/, '') : '';
      if (u) {
        if (!APP_STATE.favorites.includes(u)) {
          const newList = [...APP_STATE.favorites, u];
          saveFavorites(newList);
          triggerToast(`⭐ Added @${u} to favorites!`, 'success');
        } else {
          triggerToast(`@${u} is already in your favorites!`, 'info');
        }
        if (manInput) {
          manInput.value = '';
          const imgEl = document.getElementById('dockShoutoutAvatarImg');
          if (imgEl) imgEl.style.display = 'none';
        }
      }
    });
  }

  const dockManualInput = document.getElementById('dockManualInput');
  if (dockManualInput) {
    const imgEl = document.getElementById('dockShoutoutAvatarImg');
    dockManualInput.addEventListener('input', () => {
      processAvatarSearch(dockManualInput, imgEl, null);
    });
  }

  // Initialize Favorites Rendering
  renderFavorites();

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      triggerLiveClip();
    }
  });

  // Periodic Uptime Clock
  setInterval(() => {
    if (APP_STATE.stream.isLive || APP_STATE.settings.simMode) {
      APP_STATE.stream.uptimeSeconds += 1;
      const h = String(Math.floor(APP_STATE.stream.uptimeSeconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((APP_STATE.stream.uptimeSeconds % 3600) / 60)).padStart(2, '0');
      const s = String(APP_STATE.stream.uptimeSeconds % 60).padStart(2, '0');
      document.getElementById('uptimeCounter').textContent = `${h}:${m}:${s}`;
    }
  }, 1000);
});
