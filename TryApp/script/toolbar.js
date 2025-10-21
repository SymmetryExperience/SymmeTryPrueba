document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide === 'undefined') {
        console.error('Lucide library is not loaded.');
        return;
    }
    lucide.createIcons();

    // --- DOM Elements ---
    const selectionToolbar = document.getElementById('selection-toolbar');
    const alignBtn = document.getElementById('btn-align');
    const defaultOptions = document.getElementById('toolbar-default-options');
    const alignOptions = document.getElementById('toolbar-align-options');
    
    const organizeBtn = document.getElementById('btn-organize');
    const organizeOptions = document.getElementById('toolbar-organize-options');
    
    const colorToolbarBtn = document.getElementById('btn-toolbar-color');
    const colorPreview = document.getElementById('toolbar-color-preview');

    const controlBtns = {
        uploadFile: document.getElementById('btn-upload-file'),
        useCamera: document.getElementById('btn-use-camera'),
        download: document.getElementById('btn-download'),
        reset: document.getElementById('btn-reset'),
        undo: document.getElementById('btn-undo'),
        redo: document.getElementById('btn-redo'),
        lock: document.getElementById('btn-lock'),
        group: document.getElementById('btn-group'),
        ungroup: document.getElementById('btn-ungroup'),
    };

    const requestAction = (actionName, detail = {}) => {
        document.dispatchEvent(new CustomEvent(actionName, { detail }));
    };

    /**
     * ===== CÓDIGO MODIFICADO =====
     * Sets which group of options is visible in the selection toolbar.
     * @param {'default' | 'align' | 'organize'} viewName The view to display.
     */
    const setToolbarView = (viewName) => {
        if (!alignBtn || !defaultOptions || !alignOptions || !organizeBtn || !organizeOptions) return;

        // --- Ocultar todo lo que se puede alternar ---
        defaultOptions.classList.remove('active');
        alignOptions.classList.remove('active');
        organizeOptions.classList.remove('active');
        // Desactivar botones principales
        alignBtn.classList.remove('active');
        organizeBtn.classList.remove('active');
        // Asegurarse de que los botones principales sean visibles por defecto antes de ocultarlos selectivamente
        organizeBtn.style.display = 'flex';
        alignBtn.style.display = 'flex';

        if (viewName === 'align') {
            // Mostrar opciones de alinear
            alignOptions.classList.add('active');
            alignBtn.classList.add('active');
            // Ocultar el botón de organizar y las opciones por defecto
            organizeBtn.style.display = 'none';
        } else if (viewName === 'organize') {
            // Mostrar opciones de organizar
            organizeOptions.classList.add('active');
            organizeBtn.classList.add('active');
            // Ocultar el botón de alinear y las opciones por defecto
            alignBtn.style.display = 'none';
        } else { // Vista 'default'
            // Mostrar opciones por defecto y ambos botones principales
            defaultOptions.classList.add('active');
            organizeBtn.style.display = 'flex';
            alignBtn.style.display = 'flex';
        }
    };


    Object.keys(controlBtns).forEach(key => {
        const btn = controlBtns[key];
        if (btn && !['lock', 'group', 'ungroup'].includes(key)) {
            btn.addEventListener('click', () => requestAction(`${key}Action`));
        }
    });

    if (alignBtn) {
        alignBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (alignBtn.disabled) return;
            const isAlignViewOpen = alignOptions.classList.contains('active');
            setToolbarView(isAlignViewOpen ? 'default' : 'align');
        });
    }

    if (organizeBtn) {
        organizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (organizeBtn.disabled) return;
            const isOrganizeViewOpen = organizeOptions.classList.contains('active');
            setToolbarView(isOrganizeViewOpen ? 'default' : 'organize');
        });
    }

    if (alignOptions) {
        alignOptions.querySelectorAll('.align-btn').forEach(button => {
            button.addEventListener('click', () => {
                const alignment = button.dataset.align;
                if (alignment) {
                    requestAction('alignAction', { alignment });
                }
            });
        });
    }

    if (organizeOptions) {
        organizeOptions.querySelectorAll('.organize-btn').forEach(button => {
            button.addEventListener('click', () => {
                const order = button.dataset.order;
                if (order) {
                    requestAction('organizeAction', { order });
                }
            });
        });
    }
    
    if (controlBtns.lock) controlBtns.lock.addEventListener('click', () => requestAction('toggleLockAction'));
    if (controlBtns.group) controlBtns.group.addEventListener('click', () => requestAction('groupAction'));
    if (controlBtns.ungroup) controlBtns.ungroup.addEventListener('click', () => requestAction('ungroupAction'));
    
    if (colorToolbarBtn) {
        colorToolbarBtn.addEventListener('click', () => {
            if (colorToolbarBtn.disabled) return;
            requestAction('toggleColorPanelAction');
        });
    }

    
    const updateButtonStates = (states) => {
        controlBtns.undo.disabled = !states.undo;
        controlBtns.redo.disabled = !states.redo;
        controlBtns.download.disabled = !states.download;
        controlBtns.reset.disabled = !states.reset;
        
        alignBtn.disabled = !states.align;
        if (organizeBtn) organizeBtn.disabled = !states.align; 
        controlBtns.lock.disabled = !states.lock;
        controlBtns.group.disabled = !states.group;
        controlBtns.ungroup.disabled = !states.ungroup;
    };
    
    document.addEventListener('updateToolbarStates', (e) => {
        updateButtonStates(e.detail);
        
        if (typeof e.detail.isLocked !== 'undefined' && controlBtns.lock) {
            const iconElement = controlBtns.lock.querySelector('i');
            iconElement.textContent = e.detail.isLocked ? 'lock' : 'lock_open';
            controlBtns.lock.classList.toggle('active', e.detail.isLocked);
        }
    });

    const updateSelectionToolbarPosition = (detail) => {
        if (!selectionToolbar) return;
    
        const { bounds, color } = detail;
    
        if (bounds) {
            const toolbarOffset = 15;
            let top = bounds.y + bounds.height + toolbarOffset;
            let left = bounds.x + bounds.width / 2;
    
            selectionToolbar.style.top = `${top}px`;
            selectionToolbar.style.left = `${left}px`;
            selectionToolbar.classList.remove('hidden');
    
            if (colorToolbarBtn && colorPreview) {
                if (color) {
                    colorToolbarBtn.disabled = false;
                    colorPreview.style.backgroundColor = color;
                } else {
                    colorToolbarBtn.disabled = true;
                    colorPreview.style.backgroundColor = '#E5E7EB';
                }
            }
    
        } else {
            selectionToolbar.classList.add('hidden');
            setToolbarView('default');
        }
    };

    document.addEventListener('updateSelectionToolbar', (e) => {
        updateSelectionToolbarPosition(e.detail);
    });
    
    document.addEventListener('click', (e) => {
        if (selectionToolbar && !selectionToolbar.contains(e.target)) {
            setToolbarView('default');
        }
    });

    [controlBtns.uploadFile, controlBtns.useCamera, controlBtns.download, controlBtns.reset, controlBtns.undo, controlBtns.redo].forEach(button => {
        if (button) {
            button.addEventListener('click', () => {
                if (button.disabled) return;
                button.classList.add('active-feedback');
                setTimeout(() => button.classList.remove('active-feedback'), 300);
            });
        }
    });
});