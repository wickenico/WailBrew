import { Heart, Settings } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import type { View } from "../types";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import "./TitleBarActions.css";

interface TitleBarActionsProps {
    setView: (view: View) => void;
}

const TitleBarActions: React.FC<TitleBarActionsProps> = ({ setView }) => {
    const { t } = useTranslation();

    return (
        <div className="titlebar-actions" style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}>
            <LanguageSwitcher />
            <ThemeToggle />
            <button
                type="button"
                className="titlebar-action-btn"
                onClick={() => setView("settings")}
                title={t("menu.view.settings")}
                aria-label={t("menu.view.settings")}
            >
                <Settings size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                className="titlebar-action-btn titlebar-sponsor-btn"
                onClick={() => BrowserOpenURL("https://github.com/sponsors/wickenico")}
                title={t("sidebar.sponsor")}
                aria-label={t("sidebar.sponsor")}
            >
                <Heart size={16} strokeWidth={2} fill="currentColor" />
            </button>
        </div>
    );
};

export default TitleBarActions;
