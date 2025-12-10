import { useState, useEffect } from 'react';

/**
 * Hook to detect responsive breakpoint mode.
 * @returns {'desktop' | 'compact' | 'collapsed'} Current breakpoint mode
 * - desktop: ≥1200px (full UI)
 * - compact: 900-1199px (reduced sizes)
 * - collapsed: <900px (hamburger menu)
 */
const useBreakpoint = () => {
    const getBreakpoint = () => {
        if (typeof window === 'undefined') return 'desktop';
        const width = window.innerWidth;
        if (width >= 1200) return 'desktop';
        if (width >= 900) return 'compact';
        return 'collapsed';
    };

    const [breakpoint, setBreakpoint] = useState(getBreakpoint);

    useEffect(() => {
        const handleResize = () => {
            setBreakpoint(getBreakpoint());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return breakpoint;
};

export default useBreakpoint;
