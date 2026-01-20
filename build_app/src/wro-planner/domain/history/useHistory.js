import { useState, useCallback } from 'react';

// limits history size to prevent memory issues
const MAX_HISTORY = 50;

export default function useHistory(initialPresent) {
    const [past, setPast] = useState([]);
    const [present, setPresent] = useState(initialPresent);
    const [future, setFuture] = useState([]);

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    const undo = useCallback(() => {
        setPast(prevPast => {
            if (prevPast.length === 0) return prevPast;
            const previous = prevPast[prevPast.length - 1];
            const newPast = prevPast.slice(0, -1);
            
            setFuture(prevFuture => [present, ...prevFuture]);
            setPresent(previous);
            
            return newPast;
        });
    }, [present]);

    const redo = useCallback(() => {
        setFuture(prevFuture => {
            if (prevFuture.length === 0) return prevFuture;
            const next = prevFuture[0];
            const newFuture = prevFuture.slice(1);
            
            setPast(prevPast => [...prevPast, present]);
            setPresent(next);
            
            return newFuture;
        });
    }, [present]);

    const set = useCallback((newPresent) => {
        if (newPresent === present) return;
        
        setPast(prevPast => {
            const newPast = [...prevPast, present];
            if (newPast.length > MAX_HISTORY) {
                return newPast.slice(newPast.length - MAX_HISTORY);
            }
            return newPast;
        });
        setPresent(newPresent);
        setFuture([]);
    }, [present]);

    // For updates that shouldn't trigger history (e.g. dragging intermediate states)
    // Careful: this desyncs history if used for meaningful changes
    const setProjected = useCallback((val) => {
        setPresent(val);
    }, []);

    return {
        state: present,
        set,
        setProjected, // Use with caution, bypasses history
        undo,
        redo,
        canUndo,
        canRedo,
        past,
        future
    };
}
