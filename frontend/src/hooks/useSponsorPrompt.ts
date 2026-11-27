import { useCallback, useState } from "react";

const COUNT_KEY = "sponsorPrompt.updatedPackages";
const SHOWN_KEY = "sponsorPrompt.shown";
const THRESHOLD = 20;

const readCount = (): number => {
    try {
        return Number(localStorage.getItem(COUNT_KEY)) || 0;
    } catch {
        return 0;
    }
};

/**
 * Asks once for a sponsorship, after WailBrew has successfully updated
 * THRESHOLD packages in total. The count and the "already asked" flag live in
 * localStorage, so the prompt never shows up again once it was seen.
 */
export function useSponsorPrompt() {
    const [isPending, setIsPending] = useState(false);
    const [updatedCount, setUpdatedCount] = useState(readCount);

    const recordUpdates = useCallback((count: number) => {
        try {
            const total = readCount() + count;
            localStorage.setItem(COUNT_KEY, String(total));
            setUpdatedCount(total);
            if (total >= THRESHOLD && localStorage.getItem(SHOWN_KEY) !== "true") {
                setIsPending(true);
            }
        } catch {
            // localStorage unavailable: never prompt
        }
    }, []);

    const dismiss = useCallback(() => {
        setIsPending(false);
        try {
            localStorage.setItem(SHOWN_KEY, "true");
        } catch {
            // ignore
        }
    }, []);

    return { isPending, updatedCount, recordUpdates, dismiss };
}
