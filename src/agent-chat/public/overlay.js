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
        en: { open: 'Open AI chat', close: 'Close chat', newTab: 'Open in new tab' },
        de: { open: 'KI-Chat öffnen', close: 'Chat schließen', newTab: 'In neuem Tab öffnen' },
        fr: { open: 'Ouvrir le chat IA', close: 'Fermer le chat', newTab: 'Ouvrir dans un nouvel onglet' },
        nl: { open: 'AI-chat openen', close: 'Chat sluiten', newTab: 'Openen in nieuw tabblad' },
        es: { open: 'Abrir chat de IA', close: 'Cerrar chat', newTab: 'Abrir en una pestaña nueva' },
        it: { open: 'Apri chat IA', close: 'Chiudi chat', newTab: 'Apri in una nuova scheda' },
    };
    const labels = LABELS[(navigator.language || 'en').slice(0, 2)] || LABELS.en;

    const ICONS = {
        sparkles: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
        close: 'm8.25 4.5 7.5 7.5-7.5 7.5',
        newTab: 'M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25',
    };

    const chatUrl = new URL('./?embedded', document.currentScript.src).href;
    const chatOrigin = new URL(chatUrl).origin;
    const signInUrl = document.currentScript.dataset.signIn ? new URL(document.currentScript.dataset.signIn, location.href).href : null;
    const newTabUrl = signInUrl || new URL('./', document.currentScript.src).href;

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
            .controls {
                --pill-gradient: var(--ai-gradient, linear-gradient(110deg, #10b981, #0ea5e9, #8b5cf6, #ec4899, #8b5cf6, #0ea5e9, #10b981));
                --pill-fill: var(--ai-fill, linear-gradient(110deg, rgb(14 165 233 / 0.10), rgb(236 72 153 / 0.10)), linear-gradient(#fafafa, #fafafa));
                --pill-ink: var(--ai-3, #8b5cf6); }
            button.launch { width: auto; height: 36px; gap: 10px; padding: 0 16px 0 13px; border: 1px solid transparent;
                background-image: var(--pill-fill), var(--pill-gradient); background-origin: border-box;
                background-clip: padding-box, padding-box, border-box; background-size: 100% 100%, 100% 100%, 300% 100%;
                background-position: 0 0, 0 0, 0 0; color: var(--pill-ink); font: 600 14px/20px var(--font-sans, system-ui, sans-serif);
                box-shadow: 0 4px 14px -6px oklch(from var(--pill-ink) l c h / 0.5); animation: pill-flow 8s linear infinite;
                transition: box-shadow 500ms ease-out; }
            button.launch:hover, button.launch:focus-visible { color: var(--pill-ink); transform: none;
                box-shadow: 0 0 22px -2px oklch(from var(--pill-ink) l c h / 0.55); }
            button.launch svg { transition: transform 500ms ease-out; }
            button.launch:hover svg { transform: rotate(18deg) scale(1.12); }
            button.launch span { background: var(--pill-gradient); background-size: 300% 100%; background-clip: text; color: transparent;
                animation: pill-text 8s linear infinite; }
            @keyframes pill-flow { to { background-position: 0 0, 0 0, 300% 0; } }
            @keyframes pill-text { to { background-position: 300% 0; } }
            /* Hidden but still hit-testable: otherwise the pointer leaves .controls on its way to the button and it vanishes. */
            .new-tab { position: absolute; top: 50%; right: 100%; padding-right: 8px; opacity: 0; transform: translate(6px, -50%);
                transition: opacity 160ms ease-in, transform 160ms ease-in; }
            .controls:hover .new-tab, .controls:has(:focus-visible) .new-tab { opacity: 1; transform: translate(0, -50%);
                transition: opacity 180ms ease-out, transform 180ms ease-out; }
            .new-tab a, button.toggle:not(.launch) { position: relative; display: flex; align-items: center; justify-content: center;
                width: 36px; height: 36px; border: 1px solid transparent; border-radius: 9999px; backdrop-filter: none;
                background-image: var(--pill-fill), var(--pill-gradient); background-origin: border-box;
                background-clip: padding-box, padding-box, border-box; background-size: 100% 100%, 100% 100%, 300% 100%;
                color: var(--pill-ink); box-shadow: 0 4px 14px -6px oklch(from var(--pill-ink) l c h / 0.5);
                transition: box-shadow 500ms ease-out; }
            .new-tab a:hover, button.toggle:not(.launch):hover { color: var(--pill-ink); box-shadow: 0 0 22px -2px oklch(from var(--pill-ink) l c h / 0.55); }
            .new-tab a:focus-visible, button.toggle:not(.launch):focus-visible { outline: 2px solid var(--pill-ink); outline-offset: 2px; }
            .new-tab svg, button.toggle:not(.launch) svg { width: 16px; height: 16px; }
            .new-tab a::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 8px); right: 0; padding: 4px 8px;
                border-radius: 6px; background: #171717; color: #fafafa; font: 500 12px/16px system-ui, sans-serif; white-space: nowrap;
                opacity: 0; pointer-events: none; transition: opacity 120ms ease; }
            .new-tab a:hover::after, .new-tab a:focus-visible::after { opacity: 1; }
            @media (prefers-reduced-motion: reduce) {
                button.launch, button.launch span { animation: none; }
            }
            button[data-tip]::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 8px); right: 0; padding: 4px 8px;
                border-radius: 6px; background: #171717; color: #fafafa; font: 500 12px/16px system-ui, sans-serif; white-space: nowrap;
                opacity: 0; pointer-events: none; transition: opacity 120ms ease; }
            button[data-tip]:hover::after, button[data-tip]:focus-visible::after { opacity: 1; }
            @media (prefers-color-scheme: dark) {
                .grip:hover::after, .grip.dragging::after { background: #60a5fa; }
                button { background: rgb(38 38 38 / 0.9); color: #a3a3a3; box-shadow: 0 0 0 1px rgb(255 255 255 / 0.1); }
                button:hover { color: #f5f5f5; }
                button[data-tip]::after, .new-tab a::after { background: #f5f5f5; color: #171717; }
                .controls { --pill-fill: var(--ai-fill, linear-gradient(110deg, rgb(14 165 233 / 0.16), rgb(236 72 153 / 0.16)), linear-gradient(#18181b, #18181b)); }
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
    const newTab = document.createElement('div');
    const newTabLink = document.createElement('a');
    newTab.className = 'new-tab';
    newTabLink.href = newTabUrl;
    newTabLink.target = '_blank';
    newTabLink.rel = 'noopener';
    newTabLink.setAttribute('aria-label', labels.newTab);
    newTabLink.dataset.tip = labels.newTab;
    newTabLink.innerHTML = icon('newTab');
    newTab.append(newTabLink);
    controls.prepend(newTab);
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
