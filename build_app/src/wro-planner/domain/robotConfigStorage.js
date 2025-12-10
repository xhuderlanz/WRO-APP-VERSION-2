/**
 * Robot configuration storage utilities.
 * Persists robot dimensions to localStorage for future use (collisions, etc).
 */

const STORAGE_KEY = 'wro_robot_config';
const CONFIG_VERSION = 1;

/**
 * Returns the default robot configuration.
 * Values match DEFAULT_ROBOT from constants.js.
 */
export const getDefaultRobotConfig = () => ({
    version: CONFIG_VERSION,
    length: 20,      // cm
    width: 18,       // cm
    wheelOffset: 10  // cm (optional, distance from front to wheel axis)
});

/**
 * Loads robot configuration from localStorage.
 * Returns null if no config exists or if version mismatch.
 */
export const loadRobotConfig = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const config = JSON.parse(stored);

        // Validate version - if mismatch, return null to use defaults
        if (config.version !== CONFIG_VERSION) {
            return null;
        }

        // Validate required fields
        if (typeof config.length !== 'number' || typeof config.width !== 'number') {
            return null;
        }

        return config;
    } catch (err) {
        console.warn('Failed to load robot config from localStorage:', err);
        return null;
    }
};

/**
 * Saves robot configuration to localStorage.
 * @param {Object} config - Robot config { length, width, wheelOffset? }
 */
export const saveRobotConfig = (config) => {
    try {
        const toSave = {
            version: CONFIG_VERSION,
            length: config.length,
            width: config.width,
        };

        // Include wheelOffset only if provided
        if (typeof config.wheelOffset === 'number') {
            toSave.wheelOffset = config.wheelOffset;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
        console.warn('Failed to save robot config to localStorage:', err);
    }
};
