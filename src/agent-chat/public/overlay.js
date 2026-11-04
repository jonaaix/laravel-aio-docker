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
        en: { open: 'Open chat', close: 'Close chat', split: 'Split view', overlay: 'Overlay' },
        de: { open: 'Chat öffnen', close: 'Chat schließen', split: 'Geteilte Ansicht', overlay: 'Überlagern' },
        fr: { open: 'Ouvrir le chat', close: 'Fermer le chat', split: 'Vue partagée', overlay: 'Superposer' },
        nl: { open: 'Chat openen', close: 'Chat sluiten', split: 'Gesplitste weergave', overlay: 'Overlay' },
        es: { open: 'Abrir chat', close: 'Cerrar chat', split: 'Vista dividida', overlay: 'Superponer' },
        it: { open: 'Apri chat', close: 'Chiudi chat', split: 'Vista divisa', overlay: 'Sovrapponi' },
    };
    const labels = LABELS[(navigator.language || 'en').slice(0, 2)] || LABELS.en;

    const ICONS = {
        chat: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
        close: 'm8.25 4.5 7.5 7.5-7.5 7.5',
        split: 'M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z',
        overlay: 'M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6',
    };

    const chatUrl = new URL('./?embedded', document.currentScript.src).href;

    function readState() {
        try {
            return { open: false, width: DEFAULT_WIDTH, mode: 'overlay', ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
        }
        catch {
            return { open: false, width: DEFAULT_WIDTH, mode: 'overlay' };
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
                border-left: 1px solid rgb(0 0 0 / 0.1); box-shadow: -8px 0 24px rgb(0 0 0 / 0.08); }
            .panel.open { display: block; }
            iframe { display: block; width: 100%; height: 100%; border: 0; }
            .grip { position: absolute; top: 0; bottom: 0; left: -4px; width: 8px; cursor: ew-resize; }
            .catcher { position: fixed; inset: 0; z-index: ${Z_INDEX + 1}; display: none; cursor: ew-resize; }
            .catcher.active { display: block; }
            .controls { position: fixed; bottom: 16px; right: 16px; z-index: ${Z_INDEX}; display: flex; gap: 8px; }
            button { position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;
                padding: 0; border: 0; border-radius: 9999px; cursor: pointer; background: #171717; color: #fafafa;
                box-shadow: 0 4px 14px rgb(0 0 0 / 0.18); transition: transform 180ms ease-out; }
            button:hover { transform: scale(1.05); }
            button.quiet { background: #fff; color: #171717; box-shadow: 0 2px 10px rgb(0 0 0 / 0.12), inset 0 0 0 1px rgb(0 0 0 / 0.08); }
            button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
            svg { width: 22px; height: 22px; }
            button::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 8px); right: 0; padding: 4px 8px;
                border-radius: 6px; background: #171717; color: #fafafa; font: 500 12px/16px system-ui, sans-serif; white-space: nowrap;
                opacity: 0; pointer-events: none; transition: opacity 120ms ease; }
            button:hover::after, button:focus-visible::after { opacity: 1; }
            [hidden] { display: none !important; }
            @media (prefers-color-scheme: dark) {
                .panel { background: #1c1c1c; border-left-color: rgb(255 255 255 / 0.1); box-shadow: -8px 0 24px rgb(0 0 0 / 0.4); }
                button { background: #f5f5f5; color: #171717; }
                button.quiet { background: #262626; color: #f5f5f5; box-shadow: 0 2px 10px rgb(0 0 0 / 0.4), inset 0 0 0 1px rgb(255 255 255 / 0.1); }
                button::after { background: #f5f5f5; color: #171717; }
            }
        </style>
        <div class="panel"><div class="grip"></div></div>
        <div class="catcher"></div>
        <div class="controls">
            <button type="button" class="quiet mode"></button>
            <button type="button" class="toggle"></button>
        </div>
    `;

    const panel = root.querySelector('.panel');
    const grip = root.querySelector('.grip');
    const catcher = root.querySelector('.catcher');
    const controls = root.querySelector('.controls');
    const modeButton = root.querySelector('.mode');
    const toggleButton = root.querySelector('.toggle');
    const pageShift = document.createElement('style');
    let frame = null;

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
        const nextMode = state.mode === 'split' ? 'overlay' : 'split';
        modeButton.hidden = !state.open;
        modeButton.innerHTML = icon(nextMode);
        modeButton.dataset.tip = labels[nextMode];
        modeButton.setAttribute('aria-label', labels[nextMode]);
        toggleButton.innerHTML = icon(state.open ? 'close' : 'chat');
        toggleButton.dataset.tip = state.open ? labels.close : labels.open;
        toggleButton.setAttribute('aria-label', toggleButton.dataset.tip);
        toggleButton.setAttribute('aria-expanded', String(state.open));
        pageShift.textContent = state.open && state.mode === 'split' ? `html { margin-right: ${state.width}px !important; }` : '';
    }

    toggleButton.addEventListener('click', () => {
        state.open = !state.open;
        saveState();
        render();
    });

    modeButton.addEventListener('click', () => {
        state.mode = state.mode === 'split' ? 'overlay' : 'split';
        saveState();
        render();
    });

    grip.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        catcher.classList.add('active');
    });

    catcher.addEventListener('pointermove', (event) => {
        state.width = clampWidth(window.innerWidth - event.clientX);
        render();
    });

    catcher.addEventListener('pointerup', () => {
        catcher.classList.remove('active');
        saveState();
    });

    window.addEventListener('resize', render);

    document.head.append(pageShift);
    document.body.append(host);
    render();
})();
