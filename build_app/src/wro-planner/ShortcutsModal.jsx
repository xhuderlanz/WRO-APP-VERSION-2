import React, { useEffect, useCallback } from 'react';
import './ShortcutsModal.css';

const shortcuts = [
    {
        category: 'Edición', items: [
            { key: 'Espacio', description: 'Cambiar dirección (Adelante/Reversa) del punto seleccionado' },
            { key: 'Delete / Backspace', description: 'Eliminar waypoint o sección seleccionada' },
            { key: 'Esc', description: 'Deseleccionar / Cancelar acción actual' },
            { key: 'Tab', description: 'Alternar modo Dibujar/Editar' },
        ]
    },
    {
        category: 'Navegación', items: [
            { key: '+ / -', description: 'Zoom In / Zoom Out' },
            { key: 'Rueda del ratón', description: 'Zoom sobre el canvas' },
            { key: 'Clic central + Arrastrar', description: 'Desplazar (Pan) el canvas' },
            { key: '↑ / ↓', description: 'Seleccionar sección anterior/siguiente' },
        ]
    },
    {
        category: 'Dibujo', items: [
            { key: 'Q', description: 'Activar/desactivar Snap 45°' },
            { key: 'R', description: 'Alternar referencia Centro/Punta' },
            { key: 'O', description: 'Mostrar/ocultar robot fantasma al 100%' },
            { key: 'A', description: 'Agregar nueva sección' },
        ]
    },
    {
        category: 'Reproducción', items: [
            { key: 'Clic en MISIÓN ▶', description: 'Iniciar reproducción completa' },
            { key: 'Mantener presionado', description: 'Mostrar menú de opciones de reproducción' },
        ]
    },
];

const ShortcutsModal = ({ isOpen, onClose }) => {
    // Close on Escape key
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            // Prevent body scrolling when modal is open
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="shortcuts-modal__backdrop" onClick={onClose} />

            {/* Modal */}
            <div className="shortcuts-modal">
                <div className="shortcuts-modal__header">
                    <h2 className="shortcuts-modal__title">
                        <span className="shortcuts-modal__icon">⌨️</span>
                        Atajos de Teclado
                    </h2>
                    <button className="shortcuts-modal__close" onClick={onClose} aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                <div className="shortcuts-modal__content">
                    {shortcuts.map((group, groupIndex) => (
                        <div key={groupIndex} className="shortcuts-modal__category">
                            <h3 className="shortcuts-modal__category-title">{group.category}</h3>
                            <div className="shortcuts-modal__list">
                                {group.items.map((item, itemIndex) => (
                                    <div key={itemIndex} className="shortcuts-modal__item">
                                        <kbd className="shortcuts-modal__key">{item.key}</kbd>
                                        <span className="shortcuts-modal__description">{item.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="shortcuts-modal__footer">
                    <span className="shortcuts-modal__hint">
                        Presiona <kbd>Esc</kbd> para cerrar
                    </span>
                </div>
            </div>
        </>
    );
};

export default ShortcutsModal;
