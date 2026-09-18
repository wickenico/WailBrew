import { useEffect, useRef, useState } from "react";
import { GetSessionLogEntries } from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime";
import { isXcodeLicenseError } from "../utils/xcodeLicense";

export function useXcodeLicenseError() {
    const [hasXcodeLicenseError, setHasXcodeLicenseError] = useState(false);
    const retryGeneration = useRef(0);

    useEffect(() => {
        let cancelled = false;
        const generation = retryGeneration.current;
        const unlisten = EventsOn("sessionLogError", (entry: string) => {
            if (isXcodeLicenseError(entry)) setHasXcodeLicenseError(true);
        });

        // Recover errors emitted before the frontend subscribed during startup.
        GetSessionLogEntries()
            .then((entries) => {
                if (!cancelled && generation === retryGeneration.current && entries.some(isXcodeLicenseError)) {
                    setHasXcodeLicenseError(true);
                }
            })
            .catch((error) => console.error("Failed to check startup session logs:", error));

        return () => {
            cancelled = true;
            unlisten();
        };
    }, []);

    const clearXcodeLicenseError = () => {
        retryGeneration.current += 1;
        setHasXcodeLicenseError(false);
    };

    return { hasXcodeLicenseError, clearXcodeLicenseError };
}
