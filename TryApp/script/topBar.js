document.addEventListener('DOMContentLoaded', () => {
    // Ensure the main app's API is ready
    if (!window.appApi) {
        console.error('Main App API not found!');
        return;
    }

    // --- Top Bar Elements ---
    const topBarBtns = {
        undo: document.getElementById('btn-undo'),
        redo: document.getElementById('btn-redo'),
        layers: document.getElementById('btn-layers'),
        align: document.getElementById('btn-align'),
        lock: document.getElementById('btn-lock'),
        group: document.getElementById('btn-group'),
        ungroup: document.getElementById('btn-ungroup'),
    };

    // --- Event Listeners ---
    if (topBarBtns.undo) {
        topBarBtns.undo.addEventListener('click', window.appApi.undo);
    }

    if (topBarBtns.redo) {
        topBarBtns.redo.addEventListener('click', window.appApi.redo);
    }

    if (topBarBtns.layers) {
        topBarBtns.layers.addEventListener('click', (e) => {
            e.stopPropagation();
            window.appApi.togglePanel('layers');
        });
    }
    
    if (topBarBtns.align) {
        topBarBtns.align.addEventListener('click', (e) => {
            e.stopPropagation();
            window.appApi.togglePanel('align');
        });
    }

    if (topBarBtns.lock) {
        topBarBtns.lock.addEventListener('click', window.appApi.toggleLock);
    }

    if (topBarBtns.group) {
        topBarBtns.group.addEventListener('click', window.appApi.groupSelection);
    }

    if (topBarBtns.ungroup) {
        topBarBtns.ungroup.addEventListener('click', window.appApi.ungroupSelection);
    }
});
