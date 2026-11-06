export const isMacPlatform = (): boolean =>
    typeof navigator !== "undefined" && (navigator.userAgent.includes("Mac") || navigator.userAgent.includes("macOS"));

/**
 * Formats a keyboard shortcut for display.
 *
 * On macOS the modifiers follow Apple's HIG order (⌃ ⌥ ⇧ ⌘) and are written without
 * separators, e.g. "⇧⌘R". On other platforms they are joined with "+", e.g. "Ctrl+Shift+R".
 */
export const formatShortcut = (key: string, opts: { shift?: boolean; mac?: boolean } = {}): string => {
    const mac = opts.mac ?? isMacPlatform();
    if (mac) {
        return `${opts.shift ? "⇧" : ""}⌘${key}`;
    }
    return `Ctrl+${opts.shift ? "Shift+" : ""}${key}`;
};
