import type { RefObject } from "react";
import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Wires up the a11y behavior expected of a modal dialog: Escape-to-close,
 * a focus trap cycling Tab/Shift+Tab within the dialog, initial focus on
 * open, and restoring focus to the previously focused element on close.
 */
export function useModalA11y(open: boolean, onClose: () => void, containerRef: RefObject<HTMLElement | null>) {
    const previouslyFocused = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) return;

        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const container = containerRef.current;
        const getFocusable = (): HTMLElement[] =>
            container ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];

        const focusables = getFocusable();
        (focusables[0] ?? container)?.focus({ preventScroll: true });

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== "Tab") return;

            const items = getFocusable();
            if (items.length === 0) {
                e.preventDefault();
                return;
            }

            // Always move focus ourselves rather than falling back to the
            // browser's native Tab handling: on macOS, buttons are excluded
            // from the native tab order unless "Full Keyboard Access" is
            // enabled, so a native fallback silently does nothing for most
            // dialogs here (they're all-button).
            e.preventDefault();
            const active = document.activeElement as HTMLElement | null;
            const currentIndex = active ? items.indexOf(active) : -1;
            let nextIndex: number;
            if (e.shiftKey) {
                nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
            } else {
                nextIndex = currentIndex === -1 || currentIndex === items.length - 1 ? 0 : currentIndex + 1;
            }
            items[nextIndex].focus({ preventScroll: true });
        };

        document.addEventListener("keydown", handleKeyDown, true);
        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
            previouslyFocused.current?.focus?.({ preventScroll: true });
        };
        // Only re-run when `open` changes — `onClose` is read via a ref so an
        // identity change on every parent render doesn't tear down and
        // re-arm the trap (which was stealing focus back mid-interaction).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
}
