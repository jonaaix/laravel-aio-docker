(() => {
    if (window.top !== window.self || document.getElementById('agent-chat-overlay')) {
        return;
    }

    const STORAGE_KEY = 'agent-chat-overlay';
    const DEFAULT_WIDTH = 440;
    const MIN_WIDTH = 360;
    const MAX_SHARE = 0.7;
    const Z_INDEX = 2147483000;

    const LABELS = {
        en: { open: 'Open AI chat', close: 'Close chat' },
        de: { open: 'KI-Chat öffnen', close: 'Chat schließen' },
        fr: { open: 'Ouvrir le chat IA', close: 'Fermer le chat' },
        nl: { open: 'AI-chat openen', close: 'Chat sluiten' },
        es: { open: 'Abrir chat de IA', close: 'Cerrar chat' },
        it: { open: 'Apri chat IA', close: 'Chiudi chat' },
    };
    const labels = LABELS[(navigator.language || 'en').slice(0, 2)] || LABELS.en;

    const ICONS = {
        sparkles: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
        close: 'm8.25 4.5 7.5 7.5-7.5 7.5',
    };

    const chatUrl = new URL('./?embedded', document.currentScript.src).href;
    const chatOrigin = new URL(chatUrl).origin;
    const signInUrl = document.currentScript.dataset.signIn ? new URL(document.currentScript.dataset.signIn, location.href).href : null;

    function readState() {
        try {
            return { open: false, width: DEFAULT_WIDTH, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
        }
        catch {
            return { open: false, width: DEFAULT_WIDTH };
        }
    }

    const state = readState();

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
        catch {
            // Blocked storage only costs remembering the panel across reloads.
        }
    }

    function clampWidth(width) {
        return Math.round(Math.min(Math.max(width, MIN_WIDTH), window.innerWidth * MAX_SHARE));
    }

    function icon(name) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${ICONS[name]}"/></svg>`;
    }

    const host = document.createElement('div');
    host.id = 'agent-chat-overlay';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
        <style>
            :host { all: initial; }
            * { box-sizing: border-box; }
            .panel { position: fixed; top: 0; right: 0; bottom: 0; z-index: ${Z_INDEX}; display: none; }
            .panel.open { display: block; }
            iframe { display: block; width: 100%; height: 100%; border: 0; }
            .grip { position: absolute; top: 0; bottom: 0; left: -4px; width: 8px; cursor: col-resize; }
            .grip::after { content: ''; position: absolute; top: 0; bottom: 0; left: 2px; width: 3px; background: transparent;
                transition: background-color 150ms ease-out; }
            .grip:hover::after, .grip.dragging::after { background: #3b82f6; }
            .catcher { position: fixed; inset: 0; z-index: ${Z_INDEX + 1}; display: none; cursor: col-resize; }
            .catcher.active { display: block; }
            .controls { position: fixed; bottom: 16px; right: 16px; z-index: ${Z_INDEX}; }
            button { position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;
                padding: 0; border: 0; border-radius: 9999px; cursor: pointer; background: rgb(255 255 255 / 0.9); color: #737373;
                box-shadow: 0 0 0 1px rgb(0 0 0 / 0.08), 0 1px 3px rgb(0 0 0 / 0.08); backdrop-filter: blur(8px);
                transition: transform 180ms ease-out, color 180ms ease-out; }
            button:hover { color: #171717; }
            button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
            svg { width: 18px; height: 18px; }
            button.launch { width: auto; height: 40px; gap: 8px; padding: 0 16px 0 13px; color: #fff;
                background: linear-gradient(120deg, #6366f1, #a855f7, #ec4899) 0% 50% / 200% 100%;
                box-shadow: 0 6px 20px rgb(168 85 247 / 0.35); font: 600 14px/20px system-ui, sans-serif;
                animation: flow 6s ease-in-out infinite alternate; }
            button.launch:hover { color: #fff; transform: scale(1.04); }
            button.launch svg { animation: twinkle 2.4s ease-in-out infinite; }
            @keyframes flow { to { background-position: 100% 50%; } }
            @keyframes twinkle { 50% { transform: scale(1.18) rotate(14deg); } }
            @media (prefers-reduced-motion: reduce) {
                button.launch, button.launch svg { animation: none; }
            }
            button[data-tip]::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 8px); right: 0; padding: 4px 8px;
                border-radius: 6px; background: #171717; color: #fafafa; font: 500 12px/16px system-ui, sans-serif; white-space: nowrap;
                opacity: 0; pointer-events: none; transition: opacity 120ms ease; }
            button[data-tip]:hover::after, button[data-tip]:focus-visible::after { opacity: 1; }
            @media (prefers-color-scheme: dark) {
                .grip:hover::after, .grip.dragging::after { background: #60a5fa; }
                button { background: rgb(38 38 38 / 0.9); color: #a3a3a3; box-shadow: 0 0 0 1px rgb(255 255 255 / 0.1); }
                button:hover { color: #f5f5f5; }
                button[data-tip]::after { background: #f5f5f5; color: #171717; }
            }
        </style>
        <div class="panel"><div class="grip"></div></div>
        <div class="catcher"></div>
        <div class="controls">
            <button type="button" class="toggle"></button>
        </div>
    `;

    const panel = root.querySelector('.panel');
    const grip = root.querySelector('.grip');
    const catcher = root.querySelector('.catcher');
    const controls = root.querySelector('.controls');
    const toggleButton = root.querySelector('.toggle');
    const pageShift = document.createElement('style');
    let frame = null;
    let signInTried = false;

    window.addEventListener('message', (event) => {
        if (!signInUrl || signInTried || !frame || event.origin !== chatOrigin || event.source !== frame.contentWindow || event.data?.type !== 'agent-chat:unauthorized') {
            return;
        }
        signInTried = true;
        frame.src = signInUrl;
    });

    function render() {
        state.width = clampWidth(state.width);
        if (state.open && !frame) {
            frame = document.createElement('iframe');
            frame.src = chatUrl;
            frame.allow = 'microphone; clipboard-write; autoplay';
            panel.append(frame);
        }
        panel.classList.toggle('open', state.open);
        panel.style.width = `${state.width}px`;
        controls.style.right = state.open ? `${state.width + 16}px` : '16px';
        toggleButton.classList.toggle('launch', !state.open);
        toggleButton.innerHTML = state.open ? icon('close') : `${icon('sparkles')}<span>${labels.open}</span>`;
        if (state.open) {
            toggleButton.dataset.tip = labels.close;
        }
        else {
            delete toggleButton.dataset.tip;
        }
        toggleButton.setAttribute('aria-label', state.open ? labels.close : labels.open);
        toggleButton.setAttribute('aria-expanded', String(state.open));
        pageShift.textContent = state.open ? `
            html { margin-right: ${state.width}px !important; scrollbar-width: thin; scrollbar-color: rgb(0 0 0 / 0.22) transparent; }
            @media (prefers-color-scheme: dark) { html { scrollbar-color: rgb(255 255 255 / 0.22) transparent; } }
        ` : '';
    }

    toggleButton.addEventListener('click', () => {
        state.open = !state.open;
        saveState();
        render();
    });

    grip.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        catcher.classList.add('active');
        grip.classList.add('dragging');
    });

    catcher.addEventListener('pointermove', (event) => {
        state.width = clampWidth(window.innerWidth - event.clientX);
        render();
    });

    catcher.addEventListener('pointerup', () => {
        catcher.classList.remove('active');
        grip.classList.remove('dragging');
        saveState();
    });

    window.addEventListener('resize', render);

    document.head.append(pageShift);
    document.body.append(host);
    render();
})();
