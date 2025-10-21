document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos de Simetría ---
    const reflectionButton = document.getElementById('btn-new-feature');
    const reflectionGuide = document.getElementById('reflection-guide');
    const rotationButton = document.getElementById('btn-rotation-symmetry');
    const rotationGuides = document.getElementById('rotation-guides');
    const translationButton = document.getElementById('btn-translation-symmetry');
    const translationGuides = document.getElementById('translation-guides');

    // --- Panel de Acciones de Simetría (creado dinámicamente) ---
    const symmetryActionsPanel = document.createElement('div');
    symmetryActionsPanel.id = 'symmetry-actions';
    symmetryActionsPanel.className = 'hidden';
    symmetryActionsPanel.innerHTML = ``;
    document.getElementById('canvas-container').appendChild(symmetryActionsPanel);

    const btnAcceptSymmetry = document.getElementById('btn-accept-symmetry');
    const btnCancelSymmetry = document.getElementById('btn-cancel-symmetry');

    // --- Verificación de Elementos ---
    if (!reflectionButton || !reflectionGuide || !rotationButton || !rotationGuides || !translationButton || !translationGuides) {
        console.error("Faltan elementos de simetría en el DOM. No se pudo inicializar la lógica de exclusión.");
        return;
    }

    // --- Inicialización de Iconos ---
    lucide.createIcons();
    
    // --- Lógica de Toast Notification ---
    let toastTimeout;
    const showToast = (message, targetButton) => {
        const toastElement = document.getElementById('toast-notification');
        if (!toastElement) return;

        // Calcula la posición sobre el botón que se presionó
        const rect = targetButton.getBoundingClientRect();
        const toastTop = rect.top - 35; 
        const toastLeft = rect.left + rect.width / 2;

        toastElement.style.top = `${toastTop}px`;
        toastElement.style.left = `${toastLeft}px`;
        toastElement.textContent = message;

        clearTimeout(toastTimeout);
        
        toastElement.classList.add('show');

        // Oculta el toast después de 2 segundos
        toastTimeout = setTimeout(() => {
            toastElement.classList.remove('show');
        }, 2000);
    };

    // --- Funciones de Control ---
    const updateSymmetryActionsVisibility = () => {
        const isAnySymmetryActive = reflectionButton.classList.contains('active') ||
                                    rotationButton.classList.contains('active') ||
                                    translationButton.classList.contains('active');
        
        if (isAnySymmetryActive) {
            symmetryActionsPanel.classList.remove('hidden');
        } else {
            symmetryActionsPanel.classList.add('hidden');
        }
    };
    
    const deactivateAllModes = (isCancel = false) => {
        if (reflectionButton.classList.contains('active')) {
            reflectionButton.classList.remove('active');
            reflectionGuide.classList.add('hidden');
            if (isCancel) document.dispatchEvent(new CustomEvent('toggleReflectionMode'));
        }
        if (rotationButton.classList.contains('active')) {
            rotationButton.classList.remove('active');
            rotationGuides.classList.add('hidden');
            if (isCancel) document.dispatchEvent(new CustomEvent('toggleRotationSymmetry'));
        }
        if (translationButton.classList.contains('active')) {
            translationButton.classList.remove('active');
            translationGuides.classList.add('hidden');
            if (isCancel) document.dispatchEvent(new CustomEvent('toggleTranslationSymmetry'));
        }
        updateSymmetryActionsVisibility();
    };

   
    // --- Aceptar y cancelar ---

    const acceptSymmetryAction = () => {
        document.dispatchEvent(new CustomEvent('acceptSymmetry'));
        deactivateAllModes(false);
    };

    const cancelSymmetryAction = () => {
        document.dispatchEvent(new CustomEvent('cancelSymmetry'));
        deactivateAllModes(false);
    };


    btnAcceptSymmetry.addEventListener('click', acceptSymmetryAction);
    btnCancelSymmetry.addEventListener('click', cancelSymmetryAction);


    document.addEventListener('keydown', (e) => {
       
        const isSymmetryActive = reflectionButton.classList.contains('active') ||
                                 rotationButton.classList.contains('active') ||
                                 translationButton.classList.contains('active');
        
    
        if (!isSymmetryActive) {
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault(); 
            acceptSymmetryAction();
        } 
        
        else if (e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault(); 
            cancelSymmetryAction();
        }
    });
    

    // --- Lógica de Eventos ---
    const handleSymmetryButtonClick = (event, modeToggleEventName) => {
        const button = event.currentTarget;
        if (typeof getSelectedObjectsCount === 'function' && getSelectedObjectsCount() === 0) {
            showToast("Selecciona un elemento", button);
            return;
        }
        
        const isActivating = !button.classList.contains('active');
        deactivateAllModes(true); 
        
        if (isActivating) {
            button.classList.add('active');
            const guide = document.getElementById(button.dataset.guide);
            if(guide) guide.classList.remove('hidden');
        }
        
        document.dispatchEvent(new CustomEvent(modeToggleEventName));
        updateSymmetryActionsVisibility();
    };

    reflectionButton.dataset.guide = 'reflection-guide';
    rotationButton.dataset.guide = 'rotation-guides';
    translationButton.dataset.guide = 'translation-guides';

    reflectionButton.addEventListener('click', (e) => {
        handleSymmetryButtonClick(e, 'toggleReflectionMode');
    });

    rotationButton.addEventListener('click', (e) => {
        handleSymmetryButtonClick(e, 'toggleRotationSymmetry');
    });
    
    translationButton.addEventListener('click', (e) => {
        handleSymmetryButtonClick(e, 'toggleTranslationSymmetry');
    });


});

