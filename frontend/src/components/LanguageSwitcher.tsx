import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { mapToSupportedLanguage } from "../i18n/languageUtils";
import "./LanguageSwitcher.css";

const LANGUAGE_OPTIONS = {
    en: { flag: "🇬🇧", nameKey: "language.english" },
    de: { flag: "🇩🇪", nameKey: "language.german" },
    fr: { flag: "🇫🇷", nameKey: "language.french" },
    tr: { flag: "🇹🇷", nameKey: "language.turkish" },
    zhCN: { flag: "🇨🇳", nameKey: "language.simplified_chinese" },
    zhTW: { flag: "🇹🇼", nameKey: "language.traditional_chinese" },
    pt_BR: { flag: "🇧🇷", nameKey: "language.brazilian_portuguese" },
    ru: { flag: "🇷🇺", nameKey: "language.russian" },
    ko: { flag: "🇰🇷", nameKey: "language.korean" },
    he: { flag: "🇮🇱", nameKey: "language.hebrew" },
    es: { flag: "🇪🇸", nameKey: "language.spanish" },
} as const;

const LanguageSwitcher: React.FC = () => {
    const { t, i18n } = useTranslation();
    const currentLanguage = mapToSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [isOpen]);

    const changeLanguage = async (lng: string) => {
        const normalized = mapToSupportedLanguage(lng);
        try {
            await i18n.changeLanguage(normalized);
        } catch (error) {
            console.error("Failed to change frontend language:", error);
        }
        setIsOpen(false);
    };

    return (
        <div
            className="language-switcher"
            ref={containerRef}
            style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
        >
            <button
                type="button"
                className="titlebar-action-btn"
                onClick={() => setIsOpen((prev) => !prev)}
                title={t("language.switchLanguage")}
                aria-label={t("language.switchLanguage")}
                aria-expanded={isOpen}
            >
                <span className="language-switcher-flag">{LANGUAGE_OPTIONS[currentLanguage].flag}</span>
            </button>
            {isOpen && (
                <div className="language-switcher-menu">
                    {Object.entries(LANGUAGE_OPTIONS).map(([code, { flag, nameKey }]) => (
                        <button
                            type="button"
                            key={code}
                            className={`language-switcher-option${code === currentLanguage ? " active" : ""}`}
                            onClick={() => changeLanguage(code)}
                        >
                            <span className="language-switcher-flag">{flag}</span>
                            <span>{t(nameKey)}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
