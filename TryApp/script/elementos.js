document.addEventListener('DOMContentLoaded', () => {
    const proceduralModules = [
        { name: 'Cuadrado', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.rect(0, 0, size, size); }, getBounds: (size) => ({ x: 0, y: 0, width: size, height: size }) },
        { name: 'Círculo', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); }, getBounds: (size) => ({ x: 0, y: 0, width: size, height: size }) },
        { name: 'Triángulo Isósceles', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size, size); ctx.lineTo(0, size); ctx.closePath(); }, getBounds: (size) => ({ x: 0, y: 0, width: size, height: size }) },
        { name: 'Triángulo Rectángulo', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size, size); ctx.lineTo(0, size); ctx.closePath(); }, getBounds: (size) => ({ x: 0, y: 0, width: size, height: size }) },        
        { name: 'Rectángulo', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.rect(0, size / 4, size, size / 2); }, getBounds: (size) => ({ x: 0, y: size / 4, width: size, height: size / 2 }) },
        { name: 'Diamante', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size, size / 2); ctx.lineTo(size / 2, size); ctx.lineTo(0, size / 2); ctx.closePath(); }, getBounds: (size) => ({ x: 0, y: 0, width: size, height: size }) },
        { name: 'Elipse', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.ellipse(size / 2, size / 2, size / 2, size / 3, 0, 0, Math.PI * 2); }, getBounds: (size) => ({ x: 0, y: size / 6, width: size, height: (size * 2) / 3 }) },
        { name: 'Semicírculo', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, Math.PI, 0); ctx.closePath(); }, getBounds: (size) => ({ x: 0, y: 0, width: size, height: size / 2 }) },
        { name: 'Trapecio', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.moveTo(size * 0.2, size * 0.8); ctx.lineTo(size * 0.8, size * 0.8); ctx.lineTo(size * 0.95, size * 0.2); ctx.lineTo(size * 0.05, size * 0.2); ctx.closePath(); }, getBounds: (size) => ({ x: size * 0.05, y: size * 0.2, width: size * 0.9, height: size * 0.6 }) },
        { name: 'Paralelogramo', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.moveTo(size * 0.25, size * 0.2); ctx.lineTo(size, size * 0.2); ctx.lineTo(size * 0.75, size * 0.8); ctx.lineTo(0, size * 0.8); ctx.closePath(); }, getBounds: (size) => ({ x: 0, y: size * 0.2, width: size, height: size * 0.6 }) },
        { name: 'Rombo', drawType: 'fill', path: (ctx, size) => { ctx.beginPath(); ctx.moveTo(size / 2, size * 0.1); ctx.lineTo(size * 0.9, size / 2); ctx.lineTo(size / 2, size * 0.9); ctx.lineTo(size * 0.1, size / 2); ctx.closePath(); }, getBounds: (size) => ({ x: size * 0.1, y: size * 0.1, width: size * 0.8, height: size * 0.8 }) },

        { 
            name: 'Pentágono', 
            drawType: 'fill', 
            path: (ctx, size) => { const sides = 5; const radius = size / 2; const startAngle = -Math.PI / 2; ctx.beginPath(); ctx.moveTo(radius + radius * Math.cos(startAngle), radius + radius * Math.sin(startAngle)); for (let i = 1; i <= sides; i++) { const angle = startAngle + i * 2 * Math.PI / sides; ctx.lineTo(radius + radius * Math.cos(angle), radius + radius * Math.sin(angle)); } ctx.closePath(); },
            getBounds: (size) => {
                const sides = 5; const radius = size / 2; const startAngle = -Math.PI / 2;
                let minX = size, maxX = 0, minY = size, maxY = 0;
                for (let i = 0; i < sides; i++) {
                    const angle = startAngle + i * 2 * Math.PI / sides;
                    const x = radius + radius * Math.cos(angle); const y = radius + radius * Math.sin(angle);
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                }
                return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            }
        },
        { 
            name: 'Hexágono', 
            drawType: 'fill', 
            path: (ctx, size) => { const sides = 6; const radius = size / 2; const startAngle = -Math.PI / 2; ctx.beginPath(); ctx.moveTo(radius + radius * Math.cos(startAngle), radius + radius * Math.sin(startAngle)); for (let i = 1; i <= sides; i++) { const angle = startAngle + i * 2 * Math.PI / sides; ctx.lineTo(radius + radius * Math.cos(angle), radius + radius * Math.sin(angle)); } ctx.closePath(); },
            getBounds: (size) => {
                const sides = 6; const radius = size / 2; const startAngle = -Math.PI / 2;
                let minX = size, maxX = 0, minY = size, maxY = 0;
                for (let i = 0; i < sides; i++) {
                    const angle = startAngle + i * 2 * Math.PI / sides;
                    const x = radius + radius * Math.cos(angle); const y = radius + radius * Math.sin(angle);
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                }
                return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            }
        },
        { 
            name: 'Estrella', 
            drawType: 'fill', 
            path: (ctx, size) => { const spikes = 5; const outerRadius = size / 2; const innerRadius = size / 4; let rot = Math.PI / 2 * 3; let x = size / 2; let y = size / 2; let step = Math.PI / spikes; ctx.beginPath(); ctx.moveTo(x, y - outerRadius); for (let i = 0; i < spikes; i++) { x = size / 2 + Math.cos(rot) * outerRadius; y = size / 2 + Math.sin(rot) * outerRadius; ctx.lineTo(x, y); rot += step; x = size / 2 + Math.cos(rot) * innerRadius; y = size / 2 + Math.sin(rot) * innerRadius; ctx.lineTo(x, y); rot += step; } ctx.lineTo(size / 2, size / 2 - outerRadius); ctx.closePath(); },
            getBounds: (size) => {
                const spikes = 5; const outerRadius = size / 2; const innerRadius = size / 4; let rot = Math.PI / 2 * 3;
                let minX = size, maxX = 0, minY = size, maxY = 0;
                const step = Math.PI / spikes;
                for (let i = 0; i < spikes; i++) {
                    let x = size / 2 + Math.cos(rot) * outerRadius; let y = size / 2 + Math.sin(rot) * outerRadius;
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    rot += step;
                    x = size / 2 + Math.cos(rot) * innerRadius; y = size / 2 + Math.sin(rot) * innerRadius;
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    rot += step;
                }
                return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            }
        }
    ];
    const DEFAULT_MODULE_COLOR = '#D8D8D8';

    // --- Elementos del DOM ---
    const moduleGallery = document.getElementById('module-gallery');

    if (!moduleGallery) {
        console.error("El contenedor de la galería de módulos no fue encontrado.");
        return;
    }

    // --- Funciones de Dibujo y Generación de Imágenes ---
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

    const generateShapeAsImage = (shapeDef, size = 256) => {
        return new Promise((resolve) => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = size;
            tempCanvas.height = size;
            tempCtx.fillStyle = DEFAULT_MODULE_COLOR;
            tempCtx.strokeStyle = DEFAULT_MODULE_COLOR;
            drawModule(shapeDef, tempCtx, size);
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = tempCanvas.toDataURL();
        });
    };

    // --- Lógica Principal ---
    const populateModuleGallery = async () => {
        if (!moduleGallery) return;
        moduleGallery.innerHTML = ''; // Limpiar galería por si acaso

        for (const shapeDef of proceduralModules) {
            const img = await generateShapeAsImage(shapeDef);
            if (img) {
                const div = document.createElement('div');
                div.className = 'asset-item';
                const imgEl = document.createElement('img');
                imgEl.src = img.src;
                div.appendChild(imgEl);

                div.addEventListener('click', () => {
                    const event = new CustomEvent('addModule', {
                        detail: {
                            img: img,
                            shapeDef: shapeDef
                        }
                    });
                    document.dispatchEvent(event);
                });
                moduleGallery.appendChild(div);
            }
        }
    };

    populateModuleGallery();
});
