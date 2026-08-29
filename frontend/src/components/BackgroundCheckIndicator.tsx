import { Loader2, Timer } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import "./BackgroundCheckIndicator.css";

interface BackgroundCheckIndicatorProps {
    isRunning: boolean;
    getSecondsUntilNextCheck?: () => number;
}

const BackgroundCheckIndicator: React.FC<BackgroundCheckIndicatorProps> = ({ isRunning, getSecondsUntilNextCheck }) => {
    const { t } = useTranslation();
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const [tooltipText, setTooltipText] = useState("");
    const iconRef = useRef<HTMLDivElement>(null);

    const formatCountdown = (seconds: number): string => {
        if (seconds <= 0) return t("backgroundCheck.checkingNow");
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes > 0) {
            return t("backgroundCheck.nextCheckIn", { minutes, seconds: remainingSeconds });
        }
        return t("backgroundCheck.nextCheckInSeconds", { seconds: remainingSeconds });
    };

    useEffect(() => {
        if (showTooltip && iconRef.current) {
            const rect = iconRef.current.getBoundingClientRect();
            setTooltipPosition({
                top: rect.bottom + 8,
                left: rect.left + rect.width / 2,
            });

            if (getSecondsUntilNextCheck) {
                setTooltipText(formatCountdown(getSecondsUntilNextCheck()));
            }

            const interval = setInterval(() => {
                if (getSecondsUntilNextCheck) {
                    setTooltipText(formatCountdown(getSecondsUntilNextCheck()));
                }
            }, 1000);

            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showTooltip]);

    return (
        <div
            ref={iconRef}
            className="background-check-icon"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            {isRunning ? (
                <Loader2 size={16} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
                <Timer size={16} strokeWidth={2} />
            )}
            {showTooltip &&
                getSecondsUntilNextCheck &&
                ReactDOM.createPortal(
                    <div
                        className="background-check-tooltip"
                        style={{
                            position: "fixed",
                            top: tooltipPosition.top,
                            left: tooltipPosition.left,
                            transform: "translateX(-50%)",
                            zIndex: 99999,
                        }}
                    >
                        {tooltipText}
                    </div>,
                    document.body,
                )}
        </div>
    );
};

export default BackgroundCheckIndicator;
