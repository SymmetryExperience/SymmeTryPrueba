document.addEventListener('DOMContentLoaded', () => {
    const symmetryToolbar = document.getElementById('symmetry-toolbar');
    if (!symmetryToolbar) return;

    const btnAccept = document.getElementById('btn-accept-symmetry');
    const btnCancel = document.getElementById('btn-cancel-symmetry');
    const alignBtn = document.getElementById('btn-align-symmetry');
    const alignOptions = document.getElementById('symmetry-align-options');
    const defaultOptions = document.getElementById('symmetry-default-options');
    const colorToolbarBtn = document.getElementById('btn-toolbar-color-symmetry');
    const colorPreview = document.getElementById('toolbar-color-preview-symmetry');

    const setToolbarView = (view) => {
        if (view === 'align') {
            defaultOptions.classList.remove('active');
            alignOptions.classList.add('active');
            alignBtn.classList.add('active');
        } else {
            alignOptions.classList.remove('active');
            defaultOptions.classList.add('active');
            alignBtn.classList.remove('active');
        }
    };

    // --- Mostrar/ocultar barra de simetría ---
    document.addEventListener('updateSymmetryToolbar', (e) => {
        const { show, bounds, color } = e.detail;

        if (show && bounds) {
            const toolbarOffset = 15;
            const top = bounds.y + bounds.height + toolbarOffset;
            const left = bounds.x + bounds.width / 2;
            symmetryToolbar.style.top = `${top}px`;
            symmetryToolbar.style.left = `${left}px`;
            symmetryToolbar.classList.remove('hidden');

            // Actualizar color
            if (color && colorToolbarBtn && colorPreview) {
                colorToolbarBtn.disabled = false;
                colorPreview.style.backgroundColor = color;
            } else if (colorToolbarBtn && colorPreview) {
                colorToolbarBtn.disabled = true;
                colorPreview.style.backgroundColor = '#E5E7EB';
            }
        } else {
            symmetryToolbar.classList.add('hidden');
            setToolbarView('default');
        }
    });

    // --- Alinear ---
    alignBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const active = alignOptions.classList.contains('active');
        setToolbarView(active ? 'default' : 'align');
    });

    alignOptions.querySelectorAll('.align-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const alignment = button.dataset.align;
            if (alignment) {
                document.dispatchEvent(new CustomEvent('alignAction', { detail: { alignment } }));
            }
        });
    });

    // --- Color ---
    colorToolbarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!colorToolbarBtn.disabled) {
            document.dispatchEvent(new CustomEvent('toggleColorPanelAction'));
        }
    });

    // --- Aceptar / Cancelar ---
    btnAccept.addEventListener('click', (e) => {
        e.stopPropagation();
        document.dispatchEvent(new CustomEvent('acceptSymmetry'));
    });

    btnCancel.addEventListener('click', (e) => {
        e.stopPropagation();
        document.dispatchEvent(new CustomEvent('cancelSymmetry'));
    });

    // Cerrar alineación al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!symmetryToolbar.contains(e.target)) {
            setToolbarView('default');
        }
    });
});
