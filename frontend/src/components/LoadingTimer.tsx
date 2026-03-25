import { useState, useEffect } from 'react';

interface LoadingTimerProps {
    readonly startTime: number;
}

export function LoadingTimer({ startTime }: LoadingTimerProps) {
    const [elapsed, setElapsed] = useState(() => Date.now() - startTime);

    useEffect(() => {
        const id = setInterval(() => setElapsed(Date.now() - startTime), 100);
        return () => clearInterval(id);
    }, [startTime]);

    return (
        <div className="loading-timer">
            ⏱️ {(elapsed / 1000).toFixed(2)}s
        </div>
    );
}
