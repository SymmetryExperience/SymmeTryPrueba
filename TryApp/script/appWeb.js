// Global function to allow communication between scripts
let getSelectedObjectsCount = () => 0;

document.addEventListener('DOMContentLoaded', () => {
    // Check if lucide is available
    if (typeof lucide === 'undefined') {
        console.error('Lucide library is not loaded.');
        return;
    }
    lucide.createIcons();

    // --- Elementos del DOM ---
    const canvas = document.getElementById('main-canvas');
    const ctx = canvas.getContext('2d');
    const rotationTooltip = document.getElementById('rotation-tooltip');
    const layerItemTemplate = document.getElementById('layer-item-template');
    const selectionBoxElement = document.getElementById('selection-box'); 
    
    // Botones de la barra inferior
    const controlBtns = {
        layers: document.getElementById('btn-layers'),
        color: document.getElementById('btn-color'),
        module: document.getElementById('btn-module'),
    };
    // Paneles flotantes
    const panels = {
        layers: document.getElementById('panel-layers'),
        color: document.getElementById('panel-color'),
        module: document.getElementById('panel-module'),
    };

    const panelActions = document.getElementById('panel-actions');
    const panelColorActions = document.getElementById('panel-color-actions'); 
    const hexColorInput = document.getElementById('hex-color-input');
    const btnAcceptColor = document.getElementById('btn-accept-color');
    const btnCancelColor = document.getElementById('btn-cancel-color');
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValueDisplay = document.getElementById('opacity-value');
    
    // --- Estado de la Aplicación ---
    const backgroundColor = '#f5f8ff';
    const DEFAULT_MODULE_COLOR = '#D8D8D8';
    let moduleColor = DEFAULT_MODULE_COLOR;
    let originalModuleColor = null;
    let objects = [];
    let selectedObjects = [];
    let multiSelectionBounds = null;
    let activePanel = null;
    let cameraStream = null;
    let isPatternMode = false;
    let patternSource = null;
    let patternReplications = { x: 0, y: 0 };
    let patternSpacing = { x: 0, y: 0 };
    let groupBeingEdited = null;
    let artboard = { x: 0, y: 0, width: 0, height: 0, color: '#FFFFFF', padding: 60 };
    let isDragging = false;
    let isResizing = false;
    let isRotating = false;
    let isSelecting = false; 
    let selectionStartPos = { x: 0, y: 0 }; 
    let activeHandle = null;
    let dragOffset = { x: 0, y: 0 };
    let resizeStart = { x: 0, y: 0 };
    let rotationStart = { angle: 0, rotation: 0 };
    let originalObjectStates = [];
    const HANDLE_SIZE = 9;
    const ROTATION_HANDLE_SIZE = 10;
    const ROTATION_HANDLE_OFFSET = 30;
    const HANDLE_COLOR = '#4f86ff';
    let dragStartPos = { x: 0, y: 0 };
    let dragAxisLock = 'none';
    let history = [];
    let redoStack = [];
    let internalClipboard = null;
    let draggedLayerId = null;
    let isReflectionModeActive = false;
    let isRotationSymmetryActive = false;
    let isTranslationSymmetryActive = false; 
    const symmetrySectors = 8; 

    // Update the global function to access the current scope's selectedObjects
    getSelectedObjectsCount = () => selectedObjects.length;

    // --- START: Communication with Toolbar.js ---
    
    const dispatchToolbarUpdate = () => {
        const hasSelection = selectedObjects.length > 0;
        const singleSelection = selectedObjects.length === 1;
        const obj = hasSelection ? selectedObjects[0] : null;
        const isLocked = hasSelection ? selectedObjects.some(o => o.locked) : false;

        const detail = {
            undo: history.length > 1,
            redo: redoStack.length > 0,
            download: objects.length > 0,
            reset: objects.length > 0,
            align: hasSelection && !isLocked,
            lock: hasSelection,
            group: selectedObjects.length >= 2 && !isLocked,
            ungroup: singleSelection && isGroup(obj) && !isLocked,
            isLocked: isLocked
        };
        document.dispatchEvent(new CustomEvent('updateToolbarStates', { detail }));
    };


    const updateContextualToolbars = () => {
        const isSymmetryActive = isReflectionModeActive || isRotationSymmetryActive || isTranslationSymmetryActive;
        const hasSelection = selectedObjects.length > 0;
        const isLocked = hasSelection ? selectedObjects.some(o => o.locked) : false;
        const hasVisibleSelection = hasSelection && !isLocked;
        const bounds = hasVisibleSelection ? calculateMultiSelectBounds(selectedObjects) : null;

        // Logic for the standard selection toolbar
        let color = null;
        const showStandardToolbar = hasVisibleSelection && !isSymmetryActive;
        if (showStandardToolbar) {
            const canColor = selectedObjects.some(o => o.isModule);
            if (canColor) {
                const firstColorable = selectedObjects.find(o => o.isModule);
                color = firstColorable.color || DEFAULT_MODULE_COLOR;
            }
        }
        document.dispatchEvent(new CustomEvent('updateSelectionToolbar', {
            detail: {
                bounds: showStandardToolbar ? bounds : null,
                color: color
            }
        }));

       
        const showSymmetryToolbar = hasVisibleSelection && isSymmetryActive;
        let symmetryColor = null;

        if (showSymmetryToolbar) {
            const canColor = selectedObjects.some(o => o.isModule);
            if (canColor) {
                const firstColorable = selectedObjects.find(o => o.isModule);
                symmetryColor = firstColorable.color || DEFAULT_MODULE_COLOR;
            }
        }

        document.dispatchEvent(new CustomEvent('updateSymmetryToolbar', {
            detail: {
                show: showSymmetryToolbar,
                bounds: bounds,
                color: symmetryColor
            }
        }));

    };

   
    const dispatchSelectionToolbarUpdate = () => {
        updateContextualToolbars();
    };
    
    document.addEventListener('uploadFileAction', () => document.getElementById('file-uploader').click());
    document.addEventListener('useCameraAction', () => openCamera());
    document.addEventListener('downloadAction', () => downloadArtboard());
    document.addEventListener('resetAction', () => { 
        objects = []; 
        cancelPatternAndClose(); 
        saveState(); 
        updateSelectionState([]); 
        updateLayersPanel(); 
    });
    document.addEventListener('undoAction', () => undo());
    document.addEventListener('redoAction', () => redo());
    document.addEventListener('toggleLockAction', () => toggleLock());
    document.addEventListener('groupAction', () => groupSelection());
    document.addEventListener('ungroupAction', () => ungroupSelection());
    document.addEventListener('alignAction', (e) => {
        if (e.detail.alignment) {
            alignSelectedObject(e.detail.alignment);
        }
    });

    
    document.addEventListener('organizeAction', (e) => {
        if (e.detail.order) {
            organizeSelectedObjects(e.detail.order);
        }
    });
 
    
   
    document.addEventListener('toggleColorPanelAction', () => {
        if (selectedObjects.length > 0) {
           
            const firstColorable = selectedObjects.find(o => o.isModule);
            if (firstColorable) {
                originalModuleColor = firstColorable.color || DEFAULT_MODULE_COLOR;
            }
        } else {
            originalModuleColor = null;
        }
        togglePanel('color');
    });

    /**
     * Reorders the selected objects within the main objects array based on the specified order command.
     * @param {'front' | 'back' | 'forward' | 'backward'} order The reordering command.
     */
    const organizeSelectedObjects = (order) => {
        if (selectedObjects.length === 0) return;

        const originalObjects = [...objects]; 
        const selectedIds = new Set(selectedObjects.map(o => o.id));
        
      
        const otherObjects = objects.filter(o => !selectedIds.has(o.id));
        const orderedSelectedObjects = objects.filter(o => selectedIds.has(o.id));

        switch (order) {
            case 'front':
              
                objects = [...otherObjects, ...orderedSelectedObjects];
                break;

            case 'back':
              
                objects = [...orderedSelectedObjects, ...otherObjects];
                break;

            case 'forward':
                
                let topMostIndex = -1;
                for (let i = originalObjects.length - 1; i >= 0; i--) {
                    if (selectedIds.has(originalObjects[i].id)) {
                        topMostIndex = i;
                        break;
                    }
                }
                
               
                if (topMostIndex < originalObjects.length - 1) {
                    const tempObjects = originalObjects.filter(o => !selectedIds.has(o.id));
                    const targetObject = originalObjects[topMostIndex + 1];
                    const targetIndex = tempObjects.findIndex(o => o.id === targetObject.id);
                
                    tempObjects.splice(targetIndex + 1, 0, ...orderedSelectedObjects);
                    objects = tempObjects;
                }
                break;

            case 'backward':
                
                let bottomMostIndex = -1;
                for (let i = 0; i < originalObjects.length; i++) {
                     if (selectedIds.has(originalObjects[i].id)) {
                        bottomMostIndex = i;
                        break;
                    }
                }
               
                if (bottomMostIndex > 0) {
                    const tempObjects = originalObjects.filter(o => !selectedIds.has(o.id)); 
                    const targetObject = originalObjects[bottomMostIndex - 1];
                    const targetIndex = tempObjects.findIndex(o => o.id === targetObject.id);
                    
                    tempObjects.splice(targetIndex, 0, ...orderedSelectedObjects);
                    objects = tempObjects;
                }
                break;
        }

        saveState();
        redrawCanvas();
        updateLayersPanel(); 
    };


    const deepCloneObjects = (objArray) => {
        return objArray.map(obj => {
            const newObj = { ...obj };
            if (obj.scale) newObj.scale = { ...obj.scale };
            if (obj.children) newObj.children = deepCloneObjects(obj.children);
            if (obj._pattern) newObj._pattern = JSON.parse(JSON.stringify(obj._pattern));
            return newObj;
        });
    };
    
    const saveState = () => {
        history.push(deepCloneObjects(objects));
        redoStack = [];
        dispatchToolbarUpdate();
    };

    const undo = () => {
        if (history.length > 1) {
            const currentState = history.pop();
            redoStack.push(deepCloneObjects(currentState));
            objects = deepCloneObjects(history[history.length - 1]);
            updateSelectionState([]);
            redrawCanvas();
            updateLayersPanel();
            dispatchToolbarUpdate();
        }
    };

    const redo = () => {
        if (redoStack.length > 0) {
            const stateToRedo = redoStack.pop();
            history.push(deepCloneObjects(stateToRedo));
            objects = deepCloneObjects(stateToRedo);
            updateSelectionState([]);
            redrawCanvas();
            updateLayersPanel();
            dispatchToolbarUpdate();
        }
    };
    
    function resetRepeatUIToZero() {
        patternReplications = { x: 0, y: 0 };
        patternSpacing = { x: 0, y: 0 };
        if (isPatternMode) {
            if (patternSource) patternSource.isPatternSource = false;
            isPatternMode = false;
            patternSource = null;
        }
        redrawCanvas();
    }
    
    function canCommitPattern() { return isPatternMode && patternSource && (patternReplications.x > 0 || patternReplications.y > 0); }
    function cancelPatternAndClose() { if (isPatternMode) { if (patternSource) patternSource.isPatternSource = false; isPatternMode = false; } patternSource = null; groupBeingEdited = null; redrawCanvas(); togglePanel(null); }
    function commitAndCloseIfPossible() { if (canCommitPattern()) { commitPattern(); } else { cancelPatternAndClose(); } }


    document.addEventListener('toggleReflectionMode', () => {
        isReflectionModeActive = !isReflectionModeActive;
        updateSelectionState();
        redrawCanvas();
    });

    document.addEventListener('toggleRotationSymmetry', () => {
        isRotationSymmetryActive = !isRotationSymmetryActive;
        updateSelectionState();
        redrawCanvas();
    });

    document.addEventListener('toggleTranslationSymmetry', () => {
        isTranslationSymmetryActive = !isTranslationSymmetryActive;
        updateSelectionState();
        redrawCanvas();
    });

    
    document.addEventListener('acceptSymmetry', () => {
        const finalObjects = [];
        const allNewClones = [];
        const selectedIds = new Set(selectedObjects.map(o => o.id));

        objects.forEach(currentObject => {
            finalObjects.push(currentObject);

            if (selectedIds.has(currentObject.id)) {
                const clonesForThisObject = [];

                if (isReflectionModeActive) {
                    const centerX = artboard.x + artboard.width / 2;
                    const reflectedClone = deepCloneObjects([currentObject])[0];
                    reflectedClone.id = Date.now() + Math.random();
                    const distanceX = centerX - currentObject.x;
                    reflectedClone.x = centerX + distanceX;
                    reflectedClone.scale.x *= -1;
                    reflectedClone.rotation *= -1;
                    reflectedClone.isReflection = false; 
                    if (isGroup(reflectedClone)) {
                        reflectedClone.children.forEach(child => { child.localRotation *= -1; });
                    }
                    clonesForThisObject.push(reflectedClone);
                }

                if (isRotationSymmetryActive) {
                    const artboardCenter = { x: artboard.x + artboard.width / 2, y: artboard.y + artboard.height / 2 };
                    const angleStep = 360 / symmetrySectors;
                    for (let i = 1; i < symmetrySectors; i++) {
                        const angleRad = (angleStep * i) * Math.PI / 180;
                        const rotatedClone = deepCloneObjects([currentObject])[0];
                        rotatedClone.id = Date.now() + Math.random() + i;
                        const dx = currentObject.x - artboardCenter.x;
                        const dy = currentObject.y - artboardCenter.y;
                        rotatedClone.x = artboardCenter.x + (dx * Math.cos(angleRad) - dy * Math.sin(angleRad));
                        rotatedClone.y = artboardCenter.y + (dx * Math.sin(angleRad) + dy * Math.cos(angleRad));
                        rotatedClone.rotation = currentObject.rotation + (angleStep * i);
                        clonesForThisObject.push(rotatedClone);
                    }
                }

                if (isTranslationSymmetryActive) {
                    const sectorWidth = artboard.width / 4;
                    const relativeX = currentObject.x - artboard.x;
                    const sectorIndex = Math.floor(relativeX / sectorWidth);
                    if (sectorIndex >= 0 && sectorIndex < 4) {
                        const baseX = currentObject.x - (sectorIndex * sectorWidth);
                        for (let i = 0; i < 4; i++) {
                            if (i === sectorIndex) continue;
                            const clone = deepCloneObjects([currentObject])[0];
                            clone.id = Date.now() + Math.random() + i;
                            clone.x = baseX + (i * sectorWidth);
                            clonesForThisObject.push(clone);
                        }
                    }
                }
                
                finalObjects.push(...clonesForThisObject);
                allNewClones.push(...clonesForThisObject);
            }
        });

        objects = finalObjects;

        // Deactivate all modes
        isReflectionModeActive = false;
        isRotationSymmetryActive = false;
        isTranslationSymmetryActive = false;

       
        saveState();
        updateSelectionState([...selectedObjects, ...allNewClones]); 
        updateLayersPanel();
    });


    // CANCELAR la simetría
    document.addEventListener('cancelSymmetry', () => {
        isReflectionModeActive = false;
        isRotationSymmetryActive = false;
        isTranslationSymmetryActive = false;
        redrawCanvas();
        // Actualiza para ocultar la barra de simetría
        updateSelectionState(); 
    });



    document.addEventListener('addModule', (e) => {
        const { img, shapeDef } = e.detail;
        if (img && shapeDef) {
            createObject(img, { isModule: true, shapeDef: shapeDef });
            togglePanel(null); 
        }
    });

    const isGroup = (obj) => obj && obj.type === 'group';
    
    const resizeCanvas = () => {
        const container = document.getElementById('canvas-container');
        const oldArtboard = { ...artboard };

        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        artboard.width = canvas.width - artboard.padding * 2;
        artboard.height = canvas.height - artboard.padding * 2;
        artboard.x = artboard.padding;
        artboard.y = artboard.padding;

        const minSize = 200;
        if (artboard.width < minSize || artboard.height < minSize) {
            artboard.width = Math.max(artboard.width, minSize);
            artboard.height = Math.max(artboard.height, minSize);
            artboard.x = (canvas.width - artboard.width) / 2;
            artboard.y = (canvas.height - artboard.height) / 2;
        }

        if (oldArtboard.width > 0 && oldArtboard.height > 0) {
            const scaleRatio = Math.min(artboard.width / oldArtboard.width, artboard.height / oldArtboard.height);

            const oldCenter = { x: oldArtboard.x + oldArtboard.width / 2, y: oldArtboard.y + oldArtboard.height / 2 };
            const newCenter = { x: artboard.x + artboard.width / 2, y: artboard.y + artboard.height / 2 };

            objects.forEach(obj => {
                const relativeX = obj.x - oldCenter.x;
                const relativeY = obj.y - oldCenter.y;
                
                obj.x = newCenter.x + (relativeX * scaleRatio);
                obj.y = newCenter.y + (relativeY * scaleRatio);

                obj.scale.x *= scaleRatio;
                obj.scale.y *= scaleRatio;
            });
        }

        const reflectionGuide = document.getElementById('reflection-guide');
        const rotationGuides = document.getElementById('rotation-guides');
        const translationGuides = document.getElementById('translation-guides');

        if (reflectionGuide) {
            reflectionGuide.style.top = `${artboard.y}px`;
            reflectionGuide.style.height = `${artboard.height}px`;
            reflectionGuide.style.left = `${artboard.x + artboard.width / 2}px`;
        }

        if (rotationGuides) {
            rotationGuides.style.top = `${artboard.y}px`;
            rotationGuides.style.left = `${artboard.x}px`;
            rotationGuides.style.width = `${artboard.width}px`;
            rotationGuides.style.height = `${artboard.height}px`;
        }

        if (translationGuides) {
            translationGuides.style.top = `${artboard.y}px`;
            translationGuides.style.left = `${artboard.x}px`;
            translationGuides.style.width = `${artboard.width}px`;
            translationGuides.style.height = `${artboard.height}px`;
        }


        redrawCanvas();
    };
    
    const getObjectLocalBounds = (obj) => {
        if (obj.isModule && obj.shapeDef && obj.shapeDef.getBounds) {
            const baseSize = Math.max(obj.width, obj.height);
            const bounds = obj.shapeDef.getBounds(baseSize);
            const scaleX = obj.width / baseSize;
            const scaleY = obj.height / baseSize;
            return {
                x: (bounds.x - baseSize / 2) * scaleX,
                y: (bounds.y - baseSize / 2) * scaleY,
                width: bounds.width * scaleX,
                height: bounds.height * scaleY
            };
        } else {
            return {
                x: -obj.width / 2,
                y: -obj.height / 2,
                width: obj.width,
                height: obj.height
            };
        }
    };

    function getHandleCoords(obj) {
        if (!obj) return {};
        const localBounds = getObjectLocalBounds(obj);

        const coords = {
            tl: { x: localBounds.x, y: localBounds.y },
            tm: { x: localBounds.x + localBounds.width / 2, y: localBounds.y },
            tr: { x: localBounds.x + localBounds.width, y: localBounds.y },
            ml: { x: localBounds.x, y: localBounds.y + localBounds.height / 2 },
            mr: { x: localBounds.x + localBounds.width, y: localBounds.y + localBounds.height / 2 },
            bl: { x: localBounds.x, y: localBounds.y + localBounds.height },
            bm: { x: localBounds.x + localBounds.width / 2, y: localBounds.y + localBounds.height },
            br: { x: localBounds.x + localBounds.width, y: localBounds.y + localBounds.height }
        };

        const rotatedCoords = {};
        const angle = obj.rotation * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        for (const key in coords) {
            const h_x = coords[key].x * obj.scale.x;
            const h_y = coords[key].y * obj.scale.y;
            rotatedCoords[key] = {
                x: obj.x + (h_x * cos - h_y * sin),
                y: obj.y + (h_x * sin + h_y * cos)
            };
        }
        return rotatedCoords;
    }
    
    function getMousePos(e) { const rect = canvas.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }
    function distBetween(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
    
    function getRotationHandlePosition(obj) {
        if (!obj) return null;
        const handleCoords = getHandleCoords(obj);
        const middleLeft = handleCoords.ml;
        const center = { x: obj.x, y: obj.y };
        
        const angleFromCenterToMl = Math.atan2(middleLeft.y - center.y, middleLeft.x - center.x);
        
        return {
            x: middleLeft.x + ROTATION_HANDLE_OFFSET * Math.cos(angleFromCenterToMl),
            y: middleLeft.y + ROTATION_HANDLE_OFFSET * Math.sin(angleFromCenterToMl)
        };
    }

    function getMultiSelectRotationHandlePosition(bounds) {
        if (!bounds) return null;
        const middleLeft = { x: bounds.x, y: bounds.y + bounds.height / 2 };

        return {
            x: middleLeft.x - ROTATION_HANDLE_OFFSET,
            y: middleLeft.y
        };
    }

    const drawModule = (moduleDef, targetCtx, size) => {
        moduleDef.path(targetCtx, size);
        if (moduleDef.drawType === 'stroke') {
            targetCtx.lineWidth = Math.max(2, Math.min(8, size / 20));
            targetCtx.setLineDash([targetCtx.lineWidth * 2, targetCtx.lineWidth * 1.5]);
            targetCtx.stroke();
            targetCtx.setLineDash([]);
        } else {
            targetCtx.fill();
        }
    };

    const drawSimpleObject = (obj, targetCtx = ctx, offset = {x: 0, y: 0}) => {
        targetCtx.save();
        targetCtx.globalAlpha = obj.opacity;
        targetCtx.translate(obj.x - offset.x, obj.y - offset.y);
        targetCtx.rotate(obj.rotation * Math.PI / 180);
        targetCtx.scale(obj.scale.x, obj.scale.y);

        if (obj.shapeDef && obj.isModule) {
            targetCtx.fillStyle = obj.color || DEFAULT_MODULE_COLOR;
            targetCtx.strokeStyle = obj.color || DEFAULT_MODULE_COLOR;
            targetCtx.translate(-obj.width / 2, -obj.height / 2);
            const size = Math.max(obj.width, obj.height);
            targetCtx.save();
            targetCtx.scale(obj.width / size, obj.height / size);
            drawModule(obj.shapeDef, targetCtx, size);
            targetCtx.restore();
        } else if (obj.img) {
            targetCtx.drawImage(obj.img, -obj.width / 2, -obj.height / 2, obj.width, obj.height);
        }
        targetCtx.restore();
    };

    function drawSimpleObjectContent(obj, targetCtx) {
        targetCtx.save();
        if (obj.shapeDef && obj.isModule) {
            targetCtx.fillStyle = obj.color || DEFAULT_MODULE_COLOR;
            targetCtx.strokeStyle = obj.color || DEFAULT_MODULE_COLOR;
            targetCtx.translate(-obj.width / 2, -obj.height / 2);
            const size = Math.max(obj.width, obj.height);
            targetCtx.save();
            targetCtx.scale(obj.width / size, obj.height / size);
            drawModule(obj.shapeDef, targetCtx, size);
            targetCtx.restore();
        } else if (obj.img) {
            targetCtx.drawImage(obj.img, -obj.width / 2, -obj.height / 2, obj.width, obj.height);
        }
        targetCtx.restore();
    }

    function drawGroupContent(group, targetCtx) {
        group.children.forEach(child => {
            const childObject = child.ref;
            targetCtx.save();
            targetCtx.translate(child.localX, child.localY);
            targetCtx.rotate(child.localRotation * Math.PI / 180);
            targetCtx.scale(child.localScale.x, child.localScale.y);

            if (isGroup(childObject)) {
                drawGroupContent(childObject, targetCtx);
            } else {
                drawSimpleObjectContent(childObject, targetCtx);
            }
            targetCtx.restore();
        });
    }

    const drawGroup = (group, targetCtx = ctx, offset = {x: 0, y: 0}) => {
        targetCtx.save();
        targetCtx.globalAlpha = group.opacity;
        targetCtx.translate(group.x - offset.x, group.y - offset.y);
        targetCtx.rotate(group.rotation * Math.PI / 180);
        targetCtx.scale(group.scale.x, group.scale.y);
        
        drawGroupContent(group, targetCtx);

        targetCtx.restore();
    };
    
    const redrawCanvas = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = artboard.color;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 25;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.fillRect(artboard.x, artboard.y, artboard.width, artboard.height);
        ctx.shadowColor = 'transparent';

        if (patternSource && isPatternMode) {
             const repX = patternReplications.x > 0 ? patternReplications.x : 1;
            const repY = patternReplications.y > 0 ? patternReplications.y : 1;
            const imgWidth = patternSource.width * Math.abs(patternSource.scale.x);
            const imgHeight = patternSource.height * Math.abs(patternSource.scale.y);
            const totalCellWidth = imgWidth + patternSpacing.x;
            const totalCellHeight = imgHeight + patternSpacing.y;
            const gridWidth = totalCellWidth * repX - patternSpacing.x;
            const gridHeight = totalCellHeight * repY - patternSpacing.y;
            const startX = (canvas.width - gridWidth) / 2;
            const startY = (canvas.height - gridHeight) / 2;
            for (let i = 0; i < repY; i++) {
                for (let j = 0; j < repX; j++) {
                    const drawX = startX + j * totalCellWidth;
                    const drawY = startY + i * totalCellHeight;
                    ctx.save();
                    ctx.globalAlpha = patternSource.opacity;
                    ctx.translate(drawX + imgWidth / 2, drawY + imgHeight / 2);
                    ctx.rotate(patternSource.rotation * Math.PI / 180);
                    ctx.scale(patternSource.scale.x, patternSource.scale.y);
                    if (patternSource.shapeDef && patternSource.isModule) {
                        ctx.fillStyle = patternSource.color || DEFAULT_MODULE_COLOR;
                        ctx.strokeStyle = patternSource.color || DEFAULT_MODULE_COLOR;
                        ctx.translate(-patternSource.width / 2, -patternSource.height / 2);
                        const size = Math.max(patternSource.width, patternSource.height);
                        ctx.save();
                        ctx.scale(patternSource.width / size, patternSource.height / size);
                        drawModule(patternSource.shapeDef, ctx, size);
                        ctx.restore();
                    } else if (patternSource.img){
                        ctx.drawImage(patternSource.img, -patternSource.width / 2, -patternSource.height / 2, patternSource.width, patternSource.height);
                    }
                    ctx.restore();
                }
            }
        }

        objects.forEach(obj => {
            if (!obj.visible) return; 
            if (obj.isPatternSource && isPatternMode && !groupBeingEdited) return;
            if (groupBeingEdited && obj.id === groupBeingEdited.id) return;
            if (obj.isReflection) return; 

            if (isGroup(obj)) {
                drawGroup(obj);
            } else {
                drawSimpleObject(obj);
            }
        });

        // Previsualización de Simetría ---
        if (isReflectionModeActive) {
            const centerX = artboard.x + artboard.width / 2;
            selectedObjects.filter(o => !o.isReflection).forEach(obj => {
                if (!obj.visible) return;
                const reflectedObj = { ...obj, scale: { ...obj.scale } };
                reflectedObj.opacity = 0.5;
                const distanceX = centerX - obj.x;
                reflectedObj.x = centerX + distanceX;
                reflectedObj.scale.x *= -1;
                reflectedObj.rotation *= -1;

                if (isGroup(reflectedObj)) {
                    const reflectedGroup = deepCloneObjects([reflectedObj])[0];
                    reflectedGroup.children.forEach(child => { child.localRotation *= -1; });
                    drawGroup(reflectedGroup);
                } else {
                    drawSimpleObject(reflectedObj);
                }
            });
        }

        if (isRotationSymmetryActive) {
            const artboardCenter = { x: artboard.x + artboard.width / 2, y: artboard.y + artboard.height / 2 };
            const angleStep = 360 / symmetrySectors;

            selectedObjects.filter(o => !o.isReflection).forEach(obj => {
                if (!obj.visible) return;
                for (let i = 1; i < symmetrySectors; i++) {
                    const angleRad = (angleStep * i) * Math.PI / 180;
                    const cos = Math.cos(angleRad);
                    const sin = Math.sin(angleRad);
                    const rotatedClone = { ...obj, scale: { ...obj.scale } };
                    rotatedClone.opacity = 0.3;
                    const dx = obj.x - artboardCenter.x;
                    const dy = obj.y - artboardCenter.y;
                    rotatedClone.x = artboardCenter.x + (dx * cos - dy * sin);
                    rotatedClone.y = artboardCenter.y + (dx * sin + dy * cos);
                    rotatedClone.rotation = obj.rotation + (angleStep * i);

                    if (isGroup(rotatedClone)) {
                        drawGroup(rotatedClone);
                    } else {
                        drawSimpleObject(rotatedClone);
                    }
                }
            });
        }

        if (isTranslationSymmetryActive) {
            const sectorWidth = artboard.width / 4;
            selectedObjects.forEach(obj => {
                if (!obj.visible || obj.isReflection) return;
                const relativeX = obj.x - artboard.x;
                const sectorIndex = Math.floor(relativeX / sectorWidth);
                if (sectorIndex < 0 || sectorIndex > 3) return;
                const baseX = obj.x - (sectorIndex * sectorWidth);

                for (let i = 0; i < 4; i++) {
                    if (i === sectorIndex) continue;
                    const clone = { ...obj, scale: { ...obj.scale } };
                    clone.opacity = 0.5;
                    clone.x = baseX + (i * sectorWidth);

                    if (isGroup(clone)) {
                        drawGroup(clone);
                    } else {
                        drawSimpleObject(clone);
                    }
                }
            });
        }


        if (isDragging && dragAxisLock !== 'none' && selectedObjects.length > 0) {
            ctx.save();
            ctx.strokeStyle = '#4f86ff';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            const originalBounds = calculateMultiSelectBounds(originalObjectStates);
            const startX = originalBounds.x + originalBounds.width / 2;
            const startY = originalBounds.y + originalBounds.height / 2;
            const currentBounds = calculateMultiSelectBounds(selectedObjects);
            const currentX = currentBounds.x + currentBounds.width / 2;
            const currentY = currentBounds.y + currentBounds.height / 2;
            ctx.beginPath();
            if (dragAxisLock === 'horizontal') {
                ctx.moveTo(startX, startY);
                ctx.lineTo(currentX, startY);
            } else {
                ctx.moveTo(startX, startY);
                ctx.lineTo(startX, currentY);
            }
            ctx.stroke();
            ctx.restore();
        }

        if (selectedObjects.length === 1) {
            const obj = selectedObjects[0];
            ctx.save();
            ctx.translate(obj.x, obj.y);
            ctx.rotate(obj.rotation * Math.PI / 180);
            ctx.scale(obj.scale.x, obj.scale.y);
            ctx.strokeStyle = HANDLE_COLOR;
            const avgScale = (Math.abs(obj.scale.x) + Math.abs(obj.scale.y)) / 2;
            ctx.lineWidth = 2 / avgScale;
            ctx.setLineDash([]);
            const localBounds = getObjectLocalBounds(obj);
            ctx.strokeRect(localBounds.x, localBounds.y, localBounds.width, localBounds.height);
            ctx.restore();
            if (!obj.locked) {
                drawHandles(getHandleCoords(obj));
                const rotHandlePos = getRotationHandlePosition(obj);
                if (rotHandlePos) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(getHandleCoords(obj).ml.x, getHandleCoords(obj).ml.y);
                    ctx.lineTo(rotHandlePos.x, rotHandlePos.y);
                    ctx.strokeStyle = HANDLE_COLOR;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(rotHandlePos.x, rotHandlePos.y, ROTATION_HANDLE_SIZE / 2, 0, Math.PI * 2);
                    ctx.fillStyle = HANDLE_COLOR;
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    const iconPath = new Path2D("M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z");
                    ctx.save();
                    ctx.translate(rotHandlePos.x, rotHandlePos.y);
                    ctx.scale(0.4, 0.4);
                    ctx.translate(-12, -12);
                    ctx.fillStyle = 'white';
                    ctx.fill(iconPath);
                    ctx.restore();
                    ctx.restore();
                }
            }
        } else if (selectedObjects.length > 1) {
            const bounds = calculateMultiSelectBounds(selectedObjects);
            ctx.strokeStyle = HANDLE_COLOR;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.setLineDash([]);
            const anyLocked = selectedObjects.some(o => o.locked);
            if (!anyLocked) {
                 drawHandles(getMultiSelectHandleCoords(bounds));
                 const rotHandlePos = getMultiSelectRotationHandlePosition(bounds);
                 if (rotHandlePos) {
                     ctx.save();
                     ctx.beginPath();
                     ctx.moveTo(bounds.x, bounds.y + bounds.height / 2);
                     ctx.lineTo(rotHandlePos.x, rotHandlePos.y);
                     ctx.strokeStyle = HANDLE_COLOR;
                     ctx.lineWidth = 1.5;
                     ctx.stroke();
                     ctx.beginPath();
                     ctx.arc(rotHandlePos.x, rotHandlePos.y, ROTATION_HANDLE_SIZE / 2, 0, Math.PI * 2);
                     ctx.fillStyle = HANDLE_COLOR;
                     ctx.fill();
                     ctx.strokeStyle = 'white';
                     ctx.lineWidth = 1.5;
                     ctx.stroke();
                     const iconPath = new Path2D("M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z");
                     ctx.save();
                     ctx.translate(rotHandlePos.x, rotHandlePos.y);
                     ctx.scale(0.4, 0.4);
                     ctx.translate(-12, -12);
                     ctx.fillStyle = 'white';
                     ctx.fill(iconPath);
                     ctx.restore();
                     ctx.restore();
                 }
            }
        }
    };

    const drawHandles = (coords) => {
        ctx.save();
        ctx.fillStyle = HANDLE_COLOR;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        for (const key in coords) {
            const coord = coords[key];
            ctx.beginPath();
            ctx.rect(coord.x - HANDLE_SIZE / 2, coord.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    };

    const commitPattern = () => {
        if (!canCommitPattern()) return;
        const repX = patternReplications.x > 0 ? patternReplications.x : 1;
        const repY = patternReplications.y > 0 ? patternReplications.y : 1;
        const source = patternSource;

        const sourceClone = {
            id: source.id,
            img: source.img,
            originalImg: source.originalImg,
            shapeDef: source.shapeDef,
            isModule: source.isModule,
            color: source.color,
            width: source.width,
            height: source.height
        };

        const imgWidth = source.width;
        const imgHeight = source.height;
        const totalCellWidth = (imgWidth * Math.abs(source.scale.x)) + patternSpacing.x;
        const totalCellHeight = (imgHeight * Math.abs(source.scale.y)) + patternSpacing.y;
        const gridWidth = totalCellWidth * repX - patternSpacing.x;
        const gridHeight = totalCellHeight * repY - patternSpacing.y;
        const startX = artboard.x + (artboard.width - gridWidth) / 2;
        const startY = artboard.y + (artboard.height - gridHeight) / 2;
        const children = [];
        const groupCenterX = startX + gridWidth / 2;
        const groupCenterY = startY + gridHeight / 2;

        for (let i = 0; i < repY; i++) {
            for (let j = 0; j < repX; j++) {
                const worldX = startX + j * totalCellWidth + (imgWidth * Math.abs(source.scale.x)) / 2;
                const worldY = startY + i * totalCellHeight + (imgHeight * Math.abs(source.scale.y)) / 2;
                const child = {
                    id: Date.now() + i * 1000 + j,
                    ref: sourceClone,
                    localX: worldX - groupCenterX,
                    localY: worldY - groupCenterY,
                    localRotation: source.rotation,
                    localScale: { ...source.scale },
                    width: source.width,
                    height: source.height,
                };
                children.push(child);
            }
        }

        const group = {
            id: groupBeingEdited ? groupBeingEdited.id : Date.now(),
            type: 'group',
            x: groupCenterX,
            y: groupCenterY,
            width: gridWidth,
            height: gridHeight,
            rotation: 0,
            scale: { x: 1, y: 1 },
            opacity: source.opacity,
            children: children,
            isModule: source.isModule,
            isPatternSource: false,
            visible: true,
            locked: false,
            _pattern: {
                repsX: patternReplications.x,
                repsY: patternReplications.y,
                spacingX: patternSpacing.x,
                spacingY: patternSpacing.y,
                source: { ...sourceClone, rotation: source.rotation, scale: { ...source.scale }, opacity: source.opacity }
            }
        };

        if (groupBeingEdited) {
            const oldGroupIndex = objects.findIndex(obj => obj.id === groupBeingEdited.id);
            if (oldGroupIndex > -1) {
                objects[oldGroupIndex] = group;
            }
            groupBeingEdited = null;
        } else {
            objects.push(group);
            const sourceIndex = objects.findIndex(obj => obj.id === source.id);
            if (sourceIndex > -1) {
                objects.splice(sourceIndex, 1);
            }
        }

        isPatternMode = false;
        if (patternSource) patternSource.isPatternSource = false;
        patternSource = null;
        saveState();
        updateSelectionState([group]);
        updateLayersPanel();
    };
    
    const createObject = (img, options = {}) => {
        const { isModule = false, shapeDef = null, url = null } = options;
        const maxDim = Math.min(artboard.width, artboard.height) * (isModule ? 0.3 : 0.2);
        const aspectRatio = img.width / img.height;
        let objWidth, objHeight;

        if (aspectRatio > 1) { 
            objWidth = maxDim; 
            objHeight = maxDim / aspectRatio; 
        } else { 
            objHeight = maxDim; 
            objWidth = maxDim * aspectRatio; 
        }
        
        if (shapeDef && shapeDef.name === 'Línea Punteada') {
            objHeight = objWidth / 10;
        }
        
        let initialX;
        if (isReflectionModeActive) {
            initialX = artboard.x + artboard.width / 4;
        } else if (isTranslationSymmetryActive) {
            initialX = artboard.x + artboard.width / 8; 
        } else {
            initialX = artboard.x + artboard.width / 2;
        }
        
        const obj = {
            id: Date.now() + Math.random(),
            img: img,
            originalImg: img,
            shapeDef: shapeDef,
            x: initialX,
            y: artboard.y + artboard.height / 2,
            width: objWidth, height: objHeight,
            rotation: 0, scale: { x: 1, y: 1 },
            opacity: 1,
            isModule: isModule,
            isPatternSource: false,
            isReflection: false, 
            color: isModule ? DEFAULT_MODULE_COLOR : null,
            visible: true,
            locked: false
        };
        objects.push(obj);
        saveState();
        updateSelectionState([obj]);
        updateLayersPanel();
    };

    
    const togglePanel = (panelName) => {
        if (activePanel === panelName) {
            panelName = null;
        }
    
        Object.values(panels).forEach(panel => panel.classList.add('hidden'));
        panelActions.classList.add('hidden');
        panelColorActions.classList.add('hidden');
        panelActions.style.height = ''; 
    
        if (panelName) {
            const targetPanel = panels[panelName];
            if (targetPanel) {
                targetPanel.classList.remove('hidden');
                
                const showColorActions = panelName === 'color';
    
                if (showColorActions) {
                    panelColorActions.classList.remove('hidden');
                }
            }
        }
    
        Object.keys(controlBtns).forEach(key => {
            if (controlBtns[key]) {
                controlBtns[key].classList.toggle('active', key === panelName);
            }
        });
        activePanel = panelName;
    };

    Object.keys(controlBtns).forEach(key => {
        if (panels[key]) {
             const button = controlBtns[key];
             if (key === 'color') {
                 button.addEventListener('click', (e) => {
                     e.stopPropagation();
                     if (selectedObjects.length > 0) {
                         originalModuleColor = selectedObjects[0].color || DEFAULT_MODULE_COLOR;
                     } else {
                         originalModuleColor = null;
                     }
                     togglePanel(key);
                 });
             } else {
                 button.addEventListener('click', (e) => {
                     e.stopPropagation();
                     togglePanel(key);
                 });
             }
        }
    });

    document.body.addEventListener('click', (e) => { 
        const clickedPanel = e.target.closest('.popup-panel, #selection-toolbar, #symmetry-actions'); 
        const clickedButton = e.target.closest('.control-btn, .symmetry-btn'); 
        if (clickedPanel || clickedButton) return; 
        if (activePanel === 'symmetry') { 
            commitAndCloseIfPossible(); 
        } else { 
            togglePanel(null); 
        } 
    });
    
    Object.values(panels).forEach(p => p.addEventListener('click', e => e.stopPropagation()));

    const alignSelectedObject = (alignment) => {
        if (selectedObjects.length === 0 || selectedObjects.some(o => o.locked)) return;
    
        if (selectedObjects.length === 1) {
            const obj = selectedObjects[0];
            const bounds = calculateMultiSelectBounds([obj]);
            if (!bounds) return;
    
            let dx = 0, dy = 0;
            switch (alignment) {
                case 'left': dx = artboard.x - bounds.x; break;
                case 'center-h': dx = (artboard.x + artboard.width / 2) - (bounds.x + bounds.width / 2); break;
                case 'right': dx = (artboard.x + artboard.width) - (bounds.x + bounds.width); break;
                case 'top': dy = artboard.y - bounds.y; break;
                case 'center-v': dy = (artboard.y + artboard.height / 2) - (bounds.y + bounds.height / 2); break;
                case 'bottom': dy = (artboard.y + artboard.height) - (bounds.y + bounds.height); break;
            }
            if (dx !== 0 || dy !== 0) {
                obj.x += dx;
                obj.y += dy;
            }
        } else if (selectedObjects.length > 1) {
            const boundsOfAll = calculateMultiSelectBounds(selectedObjects);
            if (!boundsOfAll) return;
    
            const objectBounds = selectedObjects.map(obj => ({ obj, bounds: calculateMultiSelectBounds([obj]) }));
    
            switch (alignment) {
                case 'left':
                    const leftEdge = boundsOfAll.x;
                    objectBounds.forEach(({ obj, bounds }) => { obj.x += leftEdge - bounds.x; });
                    break;
                case 'right':
                    const rightEdge = boundsOfAll.x + boundsOfAll.width;
                    objectBounds.forEach(({ obj, bounds }) => { obj.x += rightEdge - (bounds.x + bounds.width); });
                    break;
                case 'center-h':
                    const groupCenterX = boundsOfAll.x + boundsOfAll.width / 2;
                    objectBounds.forEach(({ obj, bounds }) => {
                        const objCenterX = bounds.x + bounds.width / 2;
                        obj.x += groupCenterX - objCenterX;
                    });
                    break;
                case 'top':
                    const topEdge = boundsOfAll.y;
                    objectBounds.forEach(({ obj, bounds }) => { obj.y += topEdge - bounds.y; });
                    break;
                case 'bottom':
                    const bottomEdge = boundsOfAll.y + boundsOfAll.height;
                    objectBounds.forEach(({ obj, bounds }) => { obj.y += bottomEdge - (bounds.y + bounds.height); });
                    break;
                case 'center-v':
                    const groupCenterY = boundsOfAll.y + boundsOfAll.height / 2;
                    objectBounds.forEach(({ obj, bounds }) => {
                        const objCenterY = bounds.y + bounds.height / 2;
                        obj.y += groupCenterY - objCenterY;
                    });
                    break;
            }
        }
    
        saveState();
        redrawCanvas();
    };

    const toggleLock = () => {
        if (selectedObjects.length > 0) {
            const newLockedState = !selectedObjects.some(o => o.locked);
            selectedObjects.forEach(obj => obj.locked = newLockedState);
            saveState();
            updateSelectionState(selectedObjects);
            updateLayersPanel();
        }
    };

    const updateSelectionState = (newSelection = selectedObjects) => {
        selectedObjects = newSelection;
        if (selectedObjects.length > 0 && selectedObjects.some(obj => obj.isPatternSource)) {
        } else {
            resetRepeatUIToZero();
        }

        const hasSelection = selectedObjects.length > 0;
        const isLocked = hasSelection ? selectedObjects.some(o => o.locked) : false;
        
        controlBtns.color.disabled = !hasSelection || isLocked;
        controlBtns.layers.disabled = !objects.length;

        if (hasSelection) {
            const avgOpacity = selectedObjects.reduce((acc, o) => acc + (o.opacity ?? 1), 0) / selectedObjects.length;
            opacitySlider.value = avgOpacity;
            opacityValueDisplay.textContent = `${Math.round(avgOpacity * 100)}%`;
        } else {
            opacitySlider.value = 1;
            opacityValueDisplay.textContent = '100%';
        }
        
        if (activePanel === 'layers') {
            updateLayersPanel();
        }

        const deleteButton = document.querySelector('#panel-actions .btn-panel-delete');
        if (deleteButton) { deleteButton.disabled = !hasSelection || isLocked; }

        redrawCanvas();
        dispatchToolbarUpdate();
        updateContextualToolbars();
    };
    
    const applyColorToModule = (module, color) => {
        if (!module.isModule || module.locked) return;
        module.color = color;
    };

    const applyColorToGroup = (group, color) => {
       
        if (!isGroup(group) || !group.isModule || group.locked) return;
    

        group.color = color;
    
      
        group.children.forEach(child => {
            const childObject = child.ref;
    
            if (isGroup(childObject)) {
                applyColorToGroup(childObject, color);
            } else {
               
                applyColorToModule(childObject, color);
            }
        });
    };

    const deleteSelectedObject = () => { if (selectedObjects.length === 0 || selectedObjects.some(o=>o.locked)) return; const idsToDelete = new Set(selectedObjects.map(o => o.id)); objects = objects.filter(obj => !idsToDelete.has(obj.id)); saveState(); updateSelectionState([]); updateLayersPanel(); };
    const duplicateSelectedObject = () => { if (selectedObjects.length === 0 || selectedObjects.some(o=>o.locked)) return; const offset = 20; const newObjects = []; selectedObjects.forEach(obj => { let newObject; if (isGroup(obj)) { newObject = { ...obj, id: Date.now() + Math.random(), x: obj.x + offset, y: obj.y + offset, scale: { ...obj.scale }, children: obj.children.map(child => ({ ...child })) }; } else { newObject = { ...obj, id: Date.now() + Math.random(), x: obj.x + offset, y: obj.y + offset, scale: { ...obj.scale } }; } objects.push(newObject); newObjects.push(newObject); }); saveState(); updateSelectionState(newObjects); updateLayersPanel(); };
    const copySelectedObject = () => { if (selectedObjects.length === 0) return; internalClipboard = deepCloneObjects(selectedObjects); };
    const pasteFromClipboard = () => { if (!internalClipboard) return; const offset = 20; const pastedObjects = deepCloneObjects(internalClipboard); pastedObjects.forEach(obj => { obj.id = Date.now() + Math.random(); obj.x += offset; obj.y += offset; objects.push(obj); }); saveState(); updateSelectionState(pastedObjects); updateLayersPanel(); };

    const downloadArtboard = () => { const tempCanvas = document.createElement('canvas'); tempCanvas.width = artboard.width; tempCanvas.height = artboard.height; const tempCtx = tempCanvas.getContext('2d'); tempCtx.fillStyle = artboard.color; tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height); objects.forEach(obj => { if (!obj.visible) return; if (isGroup(obj)) { drawGroup(obj, tempCtx, { x: artboard.x, y: artboard.y }); } else { drawSimpleObject(obj, tempCtx, { x: artboard.x, y: artboard.y }); } }); const link = document.createElement('a'); link.download = 'diseno-redi.png'; link.href = tempCanvas.toDataURL('image/png'); link.click(); };
    
    const cameraModal = document.getElementById('camera-modal'); 
    const cameraVideo = document.getElementById('camera-video'); 
    
    const openCamera = async () => {
        togglePanel(null); 
        try { 
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); 
            cameraVideo.srcObject = cameraStream; 
            cameraModal.classList.remove('hidden'); 
        } catch (err) { 
            console.error('No se pudo acceder a la cámara:', err); 
        } 
    };

    const stopCamera = () => { if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null; } cameraModal.classList.add('hidden'); }; 
    document.getElementById('btn-close-camera').addEventListener('click', stopCamera); 
    document.getElementById('btn-capture').addEventListener('click', () => { const tc = document.createElement('canvas'); tc.width = cameraVideo.videoWidth; tc.height = cameraVideo.videoHeight; tc.getContext('2d').drawImage(cameraVideo, 0, 0); const img = new Image(); img.onload = () => createObject(img, { isModule: false }); img.src = tc.toDataURL('jpeg'); stopCamera(); }); 
    
    document.getElementById('file-uploader').addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => { const img = new Image(); img.onload = () => createObject(img, { isModule: false }); img.src = event.target.result; }; reader.readAsDataURL(file); } e.target.value = ''; });
    
    const hitTestGroup = (group, x, y) => { const dx = x - group.x; const dy = y - group.y; const angle = -group.rotation * Math.PI / 180; const cos = Math.cos(angle); const sin = Math.sin(angle); const rotatedX = dx * cos - dy * sin; const rotatedY = dx * sin + dy * cos; const localX = rotatedX / group.scale.x; const localY = rotatedY / group.scale.y; return Math.abs(localX) < group.width / 2 && Math.abs(localY) < group.height / 2; };
    
    const getObjectAtPos = (x, y) => {
        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];
            if (!obj.visible || obj.locked) continue;
            if (obj.isPatternSource && isPatternMode) continue;
            if (isGroup(obj)) {
                if (hitTestGroup(obj, x, y)) return obj;
            } else {
                const dx = x - obj.x;
                const dy = y - obj.y;
                const angle = -obj.rotation * Math.PI / 180;
                
                const rotatedMouseX = dx * Math.cos(angle) - dy * Math.sin(angle);
                const rotatedMouseY = dx * Math.sin(angle) + dy * Math.cos(angle);
                
                const localBounds = getObjectLocalBounds(obj);
                const scaledBounds = {
                    x: localBounds.x * obj.scale.x,
                    y: localBounds.y * obj.scale.y,
                    width: localBounds.width * obj.scale.x,
                    height: localBounds.height * obj.scale.y,
                };

                if (scaledBounds.width < 0) {
                    scaledBounds.x += scaledBounds.width;
                    scaledBounds.width *= -1;
                }
                if (scaledBounds.height < 0) {
                    scaledBounds.y += scaledBounds.height;
                    scaledBounds.height *= -1;
                }

                if (rotatedMouseX >= scaledBounds.x && rotatedMouseX <= scaledBounds.x + scaledBounds.width &&
                    rotatedMouseY >= scaledBounds.y && rotatedMouseY <= scaledBounds.y + scaledBounds.height) {
                    return obj;
                }
            }
        }
        return null;
    };
    
    const getHandleAtPos = (x, y) => {
        if (selectedObjects.length === 0 || selectedObjects.some(o=>o.locked)) return null;
        
        if (selectedObjects.length === 1) {
            const rotHandlePos = getRotationHandlePosition(selectedObjects[0]);
            if (rotHandlePos && distBetween(x, y, rotHandlePos.x, rotHandlePos.y) <= ROTATION_HANDLE_SIZE) {
                return 'rotate';
            }
        } else if (selectedObjects.length > 1) {
            const bounds = calculateMultiSelectBounds(selectedObjects);
            const rotHandlePos = getMultiSelectRotationHandlePosition(bounds);
            if (rotHandlePos && distBetween(x, y, rotHandlePos.x, rotHandlePos.y) <= ROTATION_HANDLE_SIZE) {
                return 'rotate';
            }
        }
        
        let handleCoords;
        if (selectedObjects.length === 1) {
            handleCoords = getHandleCoords(selectedObjects[0]);
        } else {
            const bounds = calculateMultiSelectBounds(selectedObjects);
            handleCoords = getMultiSelectHandleCoords(bounds);
        }
        for (const key in handleCoords) {
            const coord = handleCoords[key];
            if (x >= coord.x - HANDLE_SIZE / 2 && x <= coord.x + HANDLE_SIZE / 2 && y >= coord.y - HANDLE_SIZE / 2 && y <= coord.y + HANDLE_SIZE / 2) return key;
        }
        return null;
    };
    
    canvas.addEventListener('mousedown', (e) => {
        const mousePos = getMousePos(e);
        const handle = getHandleAtPos(mousePos.x, mousePos.y);

        if (handle) {
            e.stopPropagation();
            if (handle === 'rotate') {
                isRotating = true;
                let center;
                if (selectedObjects.length === 1) {
                    const obj = selectedObjects[0];
                    center = { x: obj.x, y: obj.y };
                    rotationStart = { angle: Math.atan2(mousePos.y - center.y, mousePos.x - center.x), rotation: obj.rotation };
                } else {
                     const bounds = calculateMultiSelectBounds(selectedObjects);
                     center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                     rotationStart = { angle: Math.atan2(mousePos.y - center.y, mousePos.x - center.x), rotation: 0 };
                }
                originalObjectStates = deepCloneObjects(selectedObjects);
                multiSelectionBounds = selectedObjects.length > 1 ? calculateMultiSelectBounds(selectedObjects) : null;
                canvas.style.cursor = 'grabbing';
            } else {
                isResizing = true;
                activeHandle = handle;
                resizeStart = mousePos;
                originalObjectStates = deepCloneObjects(selectedObjects);
                multiSelectionBounds = selectedObjects.length > 1 ? calculateMultiSelectBounds(selectedObjects) : null;
            }
            return;
        }

        const clickedObject = getObjectAtPos(mousePos.x, mousePos.y);
        
        if (clickedObject) {
            if (e.shiftKey) {
                const index = selectedObjects.findIndex(obj => obj.id === clickedObject.id);
                if (index > -1) {
                    selectedObjects.splice(index, 1);
                } else {
                    selectedObjects.push(clickedObject);
                }
                updateSelectionState(selectedObjects);
            } else {
                if (!selectedObjects.some(obj => obj.id === clickedObject.id)) {
                    updateSelectionState([clickedObject]);
                }
            }
            
            if (selectedObjects.some(obj => obj.id === clickedObject.id) && !clickedObject.locked) {
                isDragging = true;
                dragStartPos = mousePos;
                dragAxisLock = 'none';
                originalObjectStates = deepCloneObjects(selectedObjects);
                canvas.classList.add('dragging');
            }
        } else {
            isSelecting = true;
            selectionStartPos = mousePos;
            updateSelectionState([]);
            
            selectionBoxElement.style.left = `${mousePos.x}px`;
            selectionBoxElement.style.top = `${mousePos.y}px`;
            selectionBoxElement.style.width = '0px';
            selectionBoxElement.style.height = '0px';
            selectionBoxElement.classList.remove('hidden');

            togglePanel(null);
        }
    });


    canvas.addEventListener('mousemove', (e) => {
        const mousePos = getMousePos(e);
        const mouseX = mousePos.x;
        const mouseY = mousePos.y;

        if (isSelecting) {
            const left = Math.min(selectionStartPos.x, mouseX);
            const top = Math.min(selectionStartPos.y, mouseY);
            const width = Math.abs(mouseX - selectionStartPos.x);
            const height = Math.abs(mouseY - selectionStartPos.y);

            selectionBoxElement.style.left = `${left}px`;
            selectionBoxElement.style.top = `${top}px`;
            selectionBoxElement.style.width = `${width}px`;
            selectionBoxElement.style.height = `${height}px`;
            return;
        }

        if (isRotating) {
            let center;
            if (selectedObjects.length === 1) {
                center = { x: selectedObjects[0].x, y: selectedObjects[0].y };
            } else {
                center = { 
                    x: multiSelectionBounds.x + multiSelectionBounds.width / 2, 
                    y: multiSelectionBounds.y + multiSelectionBounds.height / 2 
                };
            }

            const currentAngle = Math.atan2(mousePos.y - center.y, mousePos.x - center.x);
            let angleDiff = currentAngle - rotationStart.angle;
            
            let newRotationDegrees = angleDiff * (180 / Math.PI);

            if (e.shiftKey) {
                 const totalRotation = rotationStart.rotation + newRotationDegrees;
                 const snappedTotal = Math.round(totalRotation / 15) * 15;
                 newRotationDegrees = snappedTotal - rotationStart.rotation;
                 angleDiff = newRotationDegrees * (Math.PI / 180);
            }

            if (selectedObjects.length === 1) {
                const obj = selectedObjects[0];
                obj.rotation = rotationStart.rotation + newRotationDegrees;
            } else {
                const cos = Math.cos(angleDiff);
                const sin = Math.sin(angleDiff);

                selectedObjects.forEach((obj, i) => {
                    const orig = originalObjectStates[i];
                    const dx = orig.x - center.x;
                    const dy = orig.y - center.y;
                    const newDx = dx * cos - dy * sin;
                    const newDy = dx * sin + dy * cos;
                    obj.x = center.x + newDx;
                    obj.y = center.y + newDy;
                    obj.rotation = orig.rotation + newRotationDegrees;
                });
            }
            
            rotationTooltip.classList.remove('hidden');
            rotationTooltip.style.left = `${mouseX}px`;
            rotationTooltip.style.top = `${mouseY + 25}px`;
            rotationTooltip.style.transform = 'translateX(-50%)';
            const displayRotation = (selectedObjects.length === 1) 
                ? selectedObjects[0].rotation 
                : newRotationDegrees;
            rotationTooltip.textContent = `${(Math.round(displayRotation % 360) + 360) % 360}°`;
            
            redrawCanvas();
            dispatchSelectionToolbarUpdate();
            return;
        }

        if (isResizing && selectedObjects.length > 0) {
            if (selectedObjects.length === 1) {
                const obj = selectedObjects[0];
                const orig = originalObjectStates[0];
                const dx = mouseX - resizeStart.x;
                const dy = mouseY - resizeStart.y;
                const angle = -orig.rotation * Math.PI / 180;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const rot_dx = dx * cos - dy * sin;
                const rot_dy = dx * sin + dy * cos;
                
                const origLocalBounds = getObjectLocalBounds(orig);
                const origVisualWidth = origLocalBounds.width * Math.abs(orig.scale.x);
                const origVisualHeight = origLocalBounds.height * Math.abs(orig.scale.y);

                let widthChange = 0;
                if (activeHandle.includes('r')) widthChange = rot_dx;
                if (activeHandle.includes('l')) widthChange = -rot_dx;
                let heightChange = 0;
                if (activeHandle.includes('b')) heightChange = rot_dy;
                if (activeHandle.includes('t')) heightChange = -rot_dy;
                const isCorner = ['tl', 'tr', 'bl', 'br'].includes(activeHandle);
                if (isCorner && e.shiftKey && origVisualHeight > 0) {
                    const aspectRatio = origVisualWidth / origVisualHeight;
                    if (Math.abs(widthChange) > Math.abs(heightChange)) {
                        heightChange = widthChange / aspectRatio;
                    } else {
                        widthChange = heightChange * aspectRatio;
                    }
                }
                let newVisualWidth = origVisualWidth + widthChange;
                let newVisualHeight = origVisualHeight + heightChange;
                const minSize = 10;
                if (newVisualWidth < minSize) newVisualWidth = minSize;
                if (newVisualHeight < minSize) newVisualHeight = minSize;

                if (origLocalBounds.width !== 0) {
                    obj.scale.x = newVisualWidth / origLocalBounds.width * Math.sign(orig.scale.x);
                }
                if (origLocalBounds.height !== 0) {
                    obj.scale.y = newVisualHeight / origLocalBounds.height * Math.sign(orig.scale.y);
                }

                const visualWidthChange = newVisualWidth - origVisualWidth;
                const visualHeightChange = newVisualHeight - origVisualHeight;
                let center_dx_visual = 0;
                if (activeHandle.includes('r')) center_dx_visual = visualWidthChange / 2;
                if (activeHandle.includes('l')) center_dx_visual = -visualWidthChange / 2;
                let center_dy_visual = 0;
                if (activeHandle.includes('b')) center_dy_visual = visualHeightChange / 2;
                if (activeHandle.includes('t')) center_dy_visual = -visualHeightChange / 2;
                const final_center_dx = center_dx_visual * cos - center_dy_visual * sin;
                const final_center_dy = center_dx_visual * sin + center_dy_visual * cos;
                obj.x = orig.x + final_center_dx;
                obj.y = orig.y + final_center_dy;
            } else {
                const origBounds = multiSelectionBounds;
                let newBounds = { ...origBounds };

                if (activeHandle.includes('r')) newBounds.width = mouseX - origBounds.x;
                if (activeHandle.includes('l')) {
                    newBounds.width = (origBounds.x + origBounds.width) - mouseX;
                    newBounds.x = mouseX;
                }
                if (activeHandle.includes('b')) newBounds.height = mouseY - origBounds.y;
                if (activeHandle.includes('t')) {
                    newBounds.height = (origBounds.y + origBounds.height) - mouseY;
                    newBounds.y = mouseY;
                }

                if (e.shiftKey && origBounds.height > 0) {
                    const aspectRatio = origBounds.width / origBounds.height;
                    const widthBasedOnHeight = newBounds.height * aspectRatio;
                    const heightBasedOnWidth = newBounds.width / aspectRatio;
                    if(activeHandle.includes('l') || activeHandle.includes('r')) {
                        newBounds.height = heightBasedOnWidth;
                    } else {
                        newBounds.width = widthBasedOnHeight;
                    }
                    if (activeHandle.includes('t')) newBounds.y = (origBounds.y + origBounds.height) - newBounds.height;
                    if (activeHandle.includes('l')) newBounds.x = (origBounds.x + origBounds.width) - newBounds.width;
                }

                const minSize = 10;
                if (newBounds.width < minSize) {
                    if(activeHandle.includes('l')) newBounds.x = newBounds.x + newBounds.width - minSize;
                    newBounds.width = minSize;
                }
                if (newBounds.height < minSize) {
                     if(activeHandle.includes('t')) newBounds.y = newBounds.y + newBounds.height - minSize;
                    newBounds.height = minSize;
                }

                const scaleX = newBounds.width / origBounds.width;
                const scaleY = newBounds.height / origBounds.height;

                selectedObjects.forEach((obj, i) => {
                    const orig = originalObjectStates[i];
                    const relativeX = orig.x - origBounds.x;
                    const relativeY = orig.y - origBounds.y;
                    obj.x = newBounds.x + (relativeX * scaleX);
                    obj.y = newBounds.y + (relativeY * scaleY);
                    obj.scale.x = orig.scale.x * scaleX;
                    obj.scale.y = orig.scale.y * scaleY;
                });
            }
            redrawCanvas();
            dispatchSelectionToolbarUpdate();
            return;
        }

        if (isDragging && selectedObjects.length > 0) {
            let total_dx = mouseX - dragStartPos.x;
            let total_dy = mouseY - dragStartPos.y;

            if (e.shiftKey) {
                if (dragAxisLock === 'none') {
                    const lockThreshold = 5;
                    if (Math.abs(total_dx) > lockThreshold || Math.abs(total_dy) > lockThreshold) {
                        dragAxisLock = Math.abs(total_dx) > Math.abs(total_dy) ? 'horizontal' : 'vertical';
                    }
                }
                if (dragAxisLock === 'horizontal') total_dy = 0;
                else if (dragAxisLock === 'vertical') total_dx = 0;
            } else {
                dragAxisLock = 'none';
            }

            selectedObjects.forEach((obj, i) => {
                const original = originalObjectStates[i];
                obj.x = original.x + total_dx;
                obj.y = original.y + total_dy;
            });
            redrawCanvas();
            dispatchSelectionToolbarUpdate();
        }
        
        const handle = getHandleAtPos(mouseX, mouseY);
        if (handle) {
            let cursor = 'default';
            if (handle === 'rotate') {
                cursor = 'grab';
            } else if (handle === 'tl' || handle === 'br') cursor = 'nwse-resize';
            else if (handle === 'tr' || handle === 'bl') cursor = 'nesw-resize';
            else if (handle === 'tm' || handle === 'bm') cursor = 'ns-resize';
            else if (handle === 'ml' || handle === 'mr') cursor = 'ew-resize';
            canvas.style.cursor = cursor;
        } else if (getObjectAtPos(mouseX, mouseY)) {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'default';
        }
    });


    canvas.addEventListener('mouseup', (e) => { 
        if (isSelecting) {
            isSelecting = false;
            selectionBoxElement.classList.add('hidden');
            
            const mousePos = getMousePos(e);
            const mouseX = mousePos.x;
            const mouseY = mousePos.y;

            const selectionRect = {
                x: Math.min(selectionStartPos.x, mouseX),
                y: Math.min(selectionStartPos.y, mouseY),
                width: Math.abs(mouseX - selectionStartPos.x),
                height: Math.abs(mouseY - selectionStartPos.y)
            };

            if (selectionRect.width > 5 || selectionRect.height > 5) {
                const newlySelected = objects.filter(obj => {
                    if (!obj.visible || obj.locked) return false;
                    
                    const objBounds = calculateMultiSelectBounds([obj]);
                    if (!objBounds) return false;

                    return (
                        objBounds.x < selectionRect.x + selectionRect.width &&
                        objBounds.x + objBounds.width > selectionRect.x &&
                        objBounds.y < selectionRect.y + selectionRect.height &&
                        objBounds.y + objBounds.height > selectionRect.y
                    );
                });
                
                updateSelectionState(newlySelected);
            }
        }

        if (isDragging || isResizing || isRotating) {
            saveState();
        }
        isDragging = false; 
        isResizing = false;
        isRotating = false;
        activeHandle = null;
        dragAxisLock = 'none';
        canvas.classList.remove('dragging');
        rotationTooltip.classList.add('hidden');
    });

    canvas.addEventListener('mouseleave', () => { 
        if (isDragging || isResizing || isRotating) { 
            saveState(); 
        } 
        isDragging = false; 
        isResizing = false; 
        isRotating = false;
        activeHandle = null; 
        dragAxisLock = 'none'; 
        canvas.classList.remove('dragging'); 
        canvas.style.cursor = 'default';
        rotationTooltip.classList.add('hidden');
    });

    const handleOpacityChange = () => { if (selectedObjects.length === 0) return; const newOpacity = parseFloat(opacitySlider.value); selectedObjects.forEach(o => o.opacity = newOpacity); updateSelectionState(); saveState(); };
    opacitySlider.addEventListener('input', handleOpacityChange);
    const colorPickerMain = document.getElementById('color-picker-main'); const hueSlider = document.getElementById('hue-slider'); const colorPointer = colorPickerMain.querySelector('.pointer'); const colorPreview = document.getElementById('color-preview-circle'); const redInput = document.getElementById('red-input'); const greenInput = document.getElementById('green-input'); const blueInput = document.getElementById('blue-input'); const hexInput = document.getElementById('hex-color-input'); const colorModeToggle = document.getElementById('color-mode-toggle'); const rgbInputsDiv = document.getElementById('rgb-inputs'); const hexInputsDiv = document.getElementById('hex-inputs'); let hue = 0, saturation = 1, value = 1; let colorModes = ['rgb', 'hex']; let currentColorMode = 0;
    function hsvToRgb(h, s, v) { let r, g, b, i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); switch (i % 6) { case 0: r = v, g = t, b = p; break; case 1: r = q, g = v, b = p; break; case 2: r = p, g = v, b = t; break; case 3: r = p, g = q, b = v; break; case 4: r = t, g = p, b = v; break; case 5: r = v, g = p, b = q; break; } return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }; }
    function rgbToHex(r, g, b) { return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase(); }
    function hexToRgb(hex) { const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null; }
    function rgbToHsv(r, g, b) { r /= 255, g /= 255, b /= 255; let max = Math.max(r, g, b), min = Math.min(r, g, b), h, s, v = max, d = max - min; s = max == 0 ? 0 : d / max; if (max == min) { h = 0; } else { switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; } h /= 6; } return { h, s, v }; }
    function updateColorUI() {
        const rgb = hsvToRgb(hue, saturation, value);
        moduleColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        colorPreview.style.backgroundColor = moduleColor;
        redInput.value = rgb.r;
        greenInput.value = rgb.g;
        blueInput.value = rgb.b;
        hexInput.value = rgbToHex(rgb.r, rgb.g, rgb.b);
        if (selectedObjects.length > 0) {
            selectedObjects.forEach(obj => {
                if (isGroup(obj)) {
                    applyColorToGroup(obj, moduleColor);
                } else {
                    applyColorToModule(obj, moduleColor);
                }
            });
            redrawCanvas();
            updateLayersPanel();
        }
        // Update toolbar color preview in real-time
        dispatchSelectionToolbarUpdate();
    }
    function updatePickerColor() { const rgb = hsvToRgb(hue, 1, 1); colorPickerMain.style.backgroundColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`; updateColorUI(); }
    function updateFromInputs() { let rgb; if (colorModes[currentColorMode] === 'rgb') { rgb = { r: parseInt(redInput.value) || 0, g: parseInt(greenInput.value) || 0, b: parseInt(blueInput.value) || 0, }; } else { rgb = hexToRgb(hexInput.value) || { r: 0, g: 0, b: 0 }; } const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b); hue = hsv.h; saturation = hsv.s; value = hsv.v; const pickerWidth = colorPickerMain.offsetWidth; const pickerHeight = colorPickerMain.offsetHeight; colorPointer.style.left = `${saturation * pickerWidth}px`; colorPointer.style.top = `${(1 - value) * pickerHeight}px`; updatePickerColor(); }
    function handlePickerDrag(e) { e.preventDefault(); const rect = colorPickerMain.getBoundingClientRect(); let x = (e.clientX || e.touches[0].clientX) - rect.left; let y = (e.clientY || e.touches[0].clientY) - rect.top; x = Math.max(0, Math.min(rect.width, x)); y = Math.max(0, Math.min(rect.height, y)); colorPointer.style.left = `${x}px`; colorPointer.style.top = `${y}px`; saturation = x / rect.width; value = 1 - (y / rect.height); updateColorUI(); }
    colorPickerMain.addEventListener('mousedown', e => { handlePickerDrag(e); const moveHandler = (moveEvent) => handlePickerDrag(moveEvent); const upHandler = () => { window.removeEventListener('mousemove', moveHandler); window.removeEventListener('mouseup', upHandler); saveState(); }; window.addEventListener('mousemove', moveHandler); window.addEventListener('mouseup', upHandler); });
    hueSlider.addEventListener('mousedown', e => { const rect = e.target.getBoundingClientRect(); const move = me => { hue = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width)); updatePickerColor(); }; move(e); const up = () => { window.removeEventListener('mousemove', move); saveState(); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up, { once: true }); });
    [redInput, greenInput, blueInput, hexInput].forEach(input => { input.addEventListener('change', () => { updateFromInputs(); saveState(); }); });
    colorModeToggle.addEventListener('click', () => { currentColorMode = (currentColorMode + 1) % colorModes.length; rgbInputsDiv.classList.toggle('active', colorModes[currentColorMode] === 'rgb'); hexInputsDiv.classList.toggle('active', colorModes[currentColorMode] === 'hex'); });
    btnAcceptColor.addEventListener('click', () => { togglePanel(null); });
    
    btnCancelColor.addEventListener('click', () => {
        if (originalModuleColor && selectedObjects.length > 0) {
            selectedObjects.forEach(obj => {
                if (isGroup(obj)) {
                    applyColorToGroup(obj, originalModuleColor);
                } else {
                    applyColorToModule(obj, originalModuleColor);
                }
            });
            redrawCanvas();
            updateLayersPanel();
        }
        togglePanel(null);
    });

    window.addEventListener('resize', resizeCanvas);
    
    document.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedObject(); } 
        else if (e.key === 'Escape') { e.preventDefault(); if (isPatternMode) { cancelPatternAndClose(); } else if (selectedObjects.length > 0) { updateSelectionState([]); } } 
        else if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSelectedObject(); } 
        else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); } 
        else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); } 
        else if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); copySelectedObject(); } 
        else if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteFromClipboard(); }
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') { e.preventDefault(); ungroupSelection(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); groupSelection(); }
    });

    const getWorldTransform = (child, group) => {
        const groupAngleRad = group.rotation * Math.PI / 180;
        const groupCos = Math.cos(groupAngleRad);
        const groupSin = Math.sin(groupAngleRad);
        const scaledLocalX = child.localX * group.scale.x;
        const scaledLocalY = child.localY * group.scale.y;
        const rotatedChildX = scaledLocalX * groupCos - scaledLocalY * groupSin;
        const rotatedChildY = scaledLocalX * groupSin + scaledLocalY * groupCos;
        const worldX = group.x + rotatedChildX;
        const worldY = group.y + rotatedChildY;
        const worldRotation = (group.rotation + child.localRotation) % 360;
        const worldScaleX = group.scale.x * child.localScale.x;
        const worldScaleY = group.scale.y * child.localScale.y;
        return { x: worldX, y: worldY, rotation: worldRotation, scale: { x: worldScaleX, y: worldScaleY } };
    };


    const groupSelection = () => {
        if (selectedObjects.length < 2) return;

        const selectedIds = new Set(selectedObjects.map(o => o.id));

        const orderedSelectedObjects = objects.filter(o => selectedIds.has(o.id));

        const bounds = calculateMultiSelectBounds(orderedSelectedObjects);
        const groupCenter = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };

        const children = orderedSelectedObjects.map(obj => ({
            ref: obj, 
            localX: obj.x - groupCenter.x,
            localY: obj.y - groupCenter.y,
            localRotation: obj.rotation,
            localScale: { ...obj.scale },
            width: obj.width,
            height: obj.height,
        }));
        
        const avgOpacity = orderedSelectedObjects.reduce((acc, o) => acc + (o.opacity ?? 1), 0) / orderedSelectedObjects.length;

        const newGroup = {
            id: Date.now() + Math.random(),
            type: 'group',
            x: groupCenter.x,
            y: groupCenter.y,
            width: bounds.width,
            height: bounds.height,
            rotation: 0,
            scale: { x: 1, y: 1 },
            opacity: avgOpacity,
            children: children,
            isModule: children.every(c => c.ref.isModule),
            visible: true,
            locked: false
        };

        objects = objects.filter(o => !selectedIds.has(o.id));
        
        objects.push(newGroup);

        saveState();
        updateSelectionState([newGroup]);
        updateLayersPanel();
    };
    
    const ungroupSelection = () => {
        if (selectedObjects.length !== 1 || !isGroup(selectedObjects[0])) return;
        
        const group = selectedObjects[0];
        const groupIndex = objects.findIndex(obj => obj.id === group.id);
        if (groupIndex === -1) return;

        const newUnpackedObjects = [];
        group.children.forEach(child => {
            const childObject = child.ref; 
            const transform = getWorldTransform(child, group);
            childObject.x = transform.x;
            childObject.y = transform.y;
            childObject.rotation = transform.rotation;
            childObject.scale = transform.scale;
            childObject.opacity = group.opacity;
            newUnpackedObjects.push(childObject);
        });

        objects.splice(groupIndex, 1, ...newUnpackedObjects);
        saveState();
        updateSelectionState(newUnpackedObjects);
        updateLayersPanel();
    };

    const calculateMultiSelectBounds = (objectsToBound) => { if (!objectsToBound || objectsToBound.length === 0) return null; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; objectsToBound.forEach(obj => { const handleCoords = getHandleCoords(obj); for (const key in handleCoords) { minX = Math.min(minX, handleCoords[key].x); minY = Math.min(minY, handleCoords[key].y); maxX = Math.max(maxX, handleCoords[key].x); maxY = Math.max(maxY, handleCoords[key].y); } }); return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }; };
    const getMultiSelectHandleCoords = (bounds) => ({ tl: { x: bounds.x, y: bounds.y }, tm: { x: bounds.x + bounds.width / 2, y: bounds.y }, tr: { x: bounds.x + bounds.width, y: bounds.y }, ml: { x: bounds.x, y: bounds.y + bounds.height / 2 }, mr: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }, bl: { x: bounds.x, y: bounds.y + bounds.height }, bm: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }, br: { x: bounds.x + bounds.width, y: bounds.y + bounds.height } });
    
    const generateObjectThumbnail = (obj, thumbSize = 28) => {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbSize;
        thumbCanvas.height = thumbSize;
        const thumbCtx = thumbCanvas.getContext('2d');
        const effectiveColor = obj.color || (isGroup(obj) && obj.color) || DEFAULT_MODULE_COLOR;
        
        thumbCtx.fillStyle = effectiveColor;
        thumbCtx.strokeStyle = effectiveColor;

        if (isGroup(obj)) {
            thumbCtx.fillStyle = '#A0AEC0';
            thumbCtx.globalAlpha = 0.8;
            thumbCtx.fillRect(thumbSize * 0.15, thumbSize * 0.15, thumbSize * 0.6, thumbSize * 0.6);
            thumbCtx.globalAlpha = 1.0;
            thumbCtx.strokeStyle = "white";
            thumbCtx.lineWidth = 2;
            thumbCtx.strokeRect(thumbSize * 0.15, thumbSize * 0.15, thumbSize * 0.6, thumbSize * 0.6);
            thumbCtx.fillStyle = '#A0AEC0';
            thumbCtx.fillRect(thumbSize * 0.3, thumbSize * 0.3, thumbSize * 0.6, thumbSize * 0.6);
        } else if (obj.isModule && obj.shapeDef) {
            const drawSize = thumbSize * 0.8;
            thumbCtx.save();
            thumbCtx.translate(thumbSize / 2, thumbSize / 2);
            thumbCtx.translate(-drawSize / 2, -drawSize / 2);
            drawModule(obj.shapeDef, thumbCtx, drawSize);
            thumbCtx.restore();
        } else if (obj.img) {
            thumbCtx.drawImage(obj.img, 0, 0, thumbSize, thumbSize);
        } else {
            thumbCtx.fillStyle = '#E2E8F0';
            thumbCtx.fillRect(0,0,thumbSize, thumbSize);
        }

        return thumbCanvas.toDataURL();
    };

    const updateLayersPanel = () => {
            const container = document.getElementById('layers-list-container');
            if (!container) return;
            container.innerHTML = '';
            const selectedIds = new Set(selectedObjects.map(o => o.id));

            // Se añade 'index' al forEach para poder calcular el número de capa
            [...objects].reverse().forEach((obj, index) => {
                const templateClone = layerItemTemplate.content.cloneNode(true);
                const item = templateClone.querySelector('.layer-item');
                const preview = templateClone.querySelector('.layer-preview');
                const name = templateClone.querySelector('.layer-name');
                const lockBtn = templateClone.querySelector('.lock-btn');
                const visBtn = templateClone.querySelector('.visibility-btn');
                const lockIcon = lockBtn.querySelector('i');
                const visIcon = visBtn.querySelector('i');
                
                item.dataset.objectId = obj.id;
                item.draggable = !obj.locked;
                item.classList.toggle('selected', selectedIds.has(obj.id));
                item.classList.toggle('hidden-layer', !obj.visible);
                item.classList.toggle('locked-layer', obj.locked);
                
                preview.src = generateObjectThumbnail(obj);

                const layerNumber = objects.length - index;
                name.textContent = `Capa ${layerNumber}`;
            
                lockIcon.textContent = obj.locked ? 'lock' : 'lock_open';
                visIcon.setAttribute('data-lucide', obj.visible ? 'eye' : 'eye-closed');

                item.addEventListener('click', (e) => {
                    if (obj.locked) return;
                    const clickedObj = objects.find(o => o.id == obj.id);
                    if (!clickedObj) return;

                    if (e.shiftKey) {
                        const index = selectedObjects.findIndex(o => o.id === clickedObj.id);
                        if (index > -1) {
                            selectedObjects.splice(index, 1);
                        } else {
                            selectedObjects.push(clickedObj);
                        }
                    } else {
                        selectedObjects = [clickedObj];
                    }
                    updateSelectionState();
                });

                visBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    obj.visible = !obj.visible;
                    if (!obj.visible && selectedObjects.some(sel => sel.id === obj.id)) {
                        updateSelectionState(selectedObjects.filter(sel => sel.id !== obj.id));
                    }
                    saveState();
                    redrawCanvas();
                    updateLayersPanel();
                });

                lockBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    obj.locked = !obj.locked;
                    if (obj.locked && selectedObjects.some(sel => sel.id === obj.id)) {
                         updateSelectionState(selectedObjects.filter(sel => sel.id !== obj.id));
                    }
                    saveState();
                    redrawCanvas();
                    updateLayersPanel();
                });

                item.addEventListener('dragstart', handleLayerDragStart);
                item.addEventListener('dragover', handleLayerDragOver);
                item.addEventListener('dragleave', handleLayerDragLeave);
                item.addEventListener('drop', handleLayerDrop);
                item.addEventListener('dragend', handleLayerDragEnd);
                
                container.appendChild(item);
                lucide.createIcons({ nodes: [visBtn] });
            });
        };

    function handleLayerDragStart(e) {
        const objectId = this.dataset.objectId;
        const obj = objects.find(o => o.id == objectId);
        if (obj && obj.locked) {
            e.preventDefault();
            return;
        }
        draggedLayerId = objectId;
        this.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleLayerDragOver(e) {
        e.preventDefault();
        const draggedItem = document.querySelector(`[data-object-id="${draggedLayerId}"]`);
        if (!draggedItem || this === draggedItem) return;
        
        const rect = this.getBoundingClientRect();
        const isAfter = e.clientY > rect.top + rect.height / 2;
        
        document.querySelectorAll('.dragging-placeholder').forEach(p => p.remove());

        const placeholder = document.createElement('div');
        placeholder.className = 'dragging-placeholder';
        
        if(isAfter) {
            this.parentNode.insertBefore(placeholder, this.nextSibling);
        } else {
            this.parentNode.insertBefore(placeholder, this);
        }
    }

    function handleLayerDragLeave(e) {
         document.querySelectorAll('.dragging-placeholder').forEach(p => p.remove());
    }

    function handleLayerDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        const container = document.getElementById('layers-list-container');
        const draggedItem = container.querySelector('.is-dragging');
        const placeholder = container.querySelector('.dragging-placeholder');
        if (!draggedItem || !placeholder) return;
        placeholder.parentNode.replaceChild(draggedItem, placeholder);
        const newOrderIds = Array.from(container.querySelectorAll('.layer-item')).map(item => item.dataset.objectId);
        
        newOrderIds.reverse();

        const newObjects = newOrderIds.map(id => objects.find(obj => obj.id == id));
        
        objects = newObjects;

        saveState();
        redrawCanvas();
        updateLayersPanel(); 
    }

   
    // Service Workers
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('Service Worker registrado con éxito:', registration.scope);
          })
          .catch(err => {
            console.error('Error en el registro del Service Worker:', err);
          });
      });
    }
    
    function handleLayerDragEnd(e) {
        draggedLayerId = null;
        document.querySelectorAll('.is-dragging').forEach(i => i.classList.remove('is-dragging'));
        document.querySelectorAll('.dragging-placeholder').forEach(p => p.remove());
    }

    document.querySelector('#panel-actions .btn-accept').addEventListener('click', () => { commitAndCloseIfPossible(); });
    document.querySelector('#panel-actions .btn-panel-delete').addEventListener('click', () => { deleteSelectedObject(); togglePanel(null); });
    
    resizeCanvas();
    updatePickerColor();
    updateLayersPanel();
    saveState();
});

// ===== INICIO: SCRIPT PARA EL NUEVO MENÚ =====
const menuToggle = document.getElementById('menuToggle');
const fullscreenMenu = document.getElementById('fullscreenMenu');
const menuLinks = document.querySelectorAll('.menu-link');
const header = document.querySelector('header');

// Efecto blur al hacer scroll
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('active');
    fullscreenMenu.classList.toggle('active');
    document.body.style.overflow = fullscreenMenu.classList.contains('active') ? 'hidden' : '';
});

// Cerrar menú al hacer click en un link
menuLinks.forEach(link => {
    link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        fullscreenMenu.classList.remove('active');
        document.body.style.overflow = '';
    });
});

// Cerrar con tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fullscreenMenu.classList.contains('active')) {
        menuToggle.classList.remove('active');
        fullscreenMenu.classList.remove('active');
        document.body.style.overflow = '';
    }
});
// ===== FIN: SCRIPT PARA EL NUEVO MENÚ =====