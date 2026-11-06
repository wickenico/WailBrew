import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

/**
 * Lets the log dialog of a long-running brew operation (update, install,
 * uninstall) be closed without losing track of the operation (#542).
 *
 * Closing the dialog while the operation runs only hides it: the caller keeps
 * its event listeners, logs and running state, and can show it again. When the
 * operation finishes while hidden, the result stored in `resultRef` is shown as
 * a toast and `onFinishedWhileHidden` clears the caller's dialog state.
 */
export function useHideableOperation(isRunning: boolean, onFinishedWhileHidden: () => void) {
    const [isHidden, setIsHidden] = useState<boolean>(false);
    const resultRef = useRef<string | null>(null);
    const onFinishedRef = useRef(onFinishedWhileHidden);
    onFinishedRef.current = onFinishedWhileHidden;

    useEffect(() => {
        if (isRunning || !isHidden) return;
        const result = resultRef.current;
        if (result) {
            toast(result, { duration: 5000, position: "bottom-center" });
        }
        resultRef.current = null;
        setIsHidden(false);
        onFinishedRef.current();
    }, [isRunning, isHidden]);

    return { isHidden, setIsHidden, resultRef };
}
