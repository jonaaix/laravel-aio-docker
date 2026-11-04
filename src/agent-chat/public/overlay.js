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
        en: { open: 'Open chat', close: 'Close chat' },
        de: { open: 'Chat öffnen', close: 'Chat schließen' },
        fr: { open: 'Ouvrir le chat', close: 'Fermer le chat' },
        nl: { open: 'Chat openen', close: 'Chat sluiten' },
        es: { open: 'Abrir chat', close: 'Cerrar chat' },
        it: { open: 'Apri chat', close: 'Chiudi chat' },
    };
    const labels = LABELS[(navigator.language || 'en').slice(0, 2)] || LABELS.en;

    const ICONS = {
        chat: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
        close: 'm8.25 4.5 7.5 7.5-7.5 7.5',
    };

    const chatUrl = new URL('./?embedded', document.currentScript.src).href;

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
            .panel { position: fixed; top: 0; right: 0; bottom: 0; z-index: ${Z_INDEX}; display: none; background: #fafafa;
                border-left: 1px solid rgb(0 0 0 / 0.1); }
            .panel.open { display: block; }
            iframe { display: block; width: 100%; height: 100%; border: 0; }
            .grip { position: absolute; top: 0; bottom: 0; left: -4px; width: 8px; cursor: col-resize; }
            .grip::after { content: ''; position: absolute; top: 0; bottom: 0; left: 2px; width: 3px; background: transparent;
                transition: background-color 150ms ease-out; }
            .grip:hover::after, .grip.dragging::after { background: #3b82f6; }
            .catcher { position: fixed; inset: 0; z-index: ${Z_INDEX + 1}; display: none; cursor: col-resize; }
            .catcher.active { display: block; }
            .controls { position: fixed; bottom: 16px; right: 16px; z-index: ${Z_INDEX}; }
            button { position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;
                padding: 0; border: 0; border-radius: 9999px; cursor: pointer; background: #171717; color: #fafafa;
                box-shadow: 0 4px 14px rgb(0 0 0 / 0.18); transition: transform 180ms ease-out; }
            button:hover { transform: scale(1.05); }
            button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
            svg { width: 22px; height: 22px; }
            button::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 8px); right: 0; padding: 4px 8px;
                border-radius: 6px; background: #171717; color: #fafafa; font: 500 12px/16px system-ui, sans-serif; white-space: nowrap;
                opacity: 0; pointer-events: none; transition: opacity 120ms ease; }
            button:hover::after, button:focus-visible::after { opacity: 1; }
            @media (prefers-color-scheme: dark) {
                .panel { background: #1c1c1c; border-left-color: rgb(255 255 255 / 0.1); }
                .grip:hover::after, .grip.dragging::after { background: #60a5fa; }
                button { background: #f5f5f5; color: #171717; }
                button::after { background: #f5f5f5; color: #171717; }
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

    function render() {
        state.width = clampWidth(state.width);
        if (state.open && !frame && document.readyState === 'complete') {
            frame = document.createElement('iframe');
            frame.src = chatUrl;
            frame.allow = 'microphone; clipboard-write; autoplay';
            panel.append(frame);
        }
        panel.classList.toggle('open', state.open);
        panel.style.width = `${state.width}px`;
        controls.style.right = state.open ? `${state.width + 16}px` : '16px';
        toggleButton.innerHTML = icon(state.open ? 'close' : 'chat');
        toggleButton.dataset.tip = state.open ? labels.close : labels.open;
        toggleButton.setAttribute('aria-label', toggleButton.dataset.tip);
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
    window.addEventListener('load', render, { once: true });

    document.head.append(pageShift);
    document.body.append(host);
    render();
})();
