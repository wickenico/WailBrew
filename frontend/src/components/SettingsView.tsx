import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GetBrewPath, SetBrewPath } from "../../wailsjs/go/main/App";
import toast from 'react-hot-toast';

interface SettingsViewProps {
    onRefreshPackages: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onRefreshPackages }) => {
    const { t } = useTranslation();
    const [brewPath, setBrewPath] = useState<string>("");
    const [newBrewPath, setNewBrewPath] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [isBrewPathExpanded, setIsBrewPathExpanded] = useState<boolean>(false);

    useEffect(() => {
        loadCurrentBrewPath();
    }, []);

    const loadCurrentBrewPath = async () => {
        try {
            setLoading(true);
            const currentPath = await GetBrewPath();
            setBrewPath(currentPath);
            setNewBrewPath(currentPath);
        } catch (error) {
            console.error("Failed to get brew path:", error);
            toast.error(t('settings.errors.failedToGetPath'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (newBrewPath.trim() === "") {
            toast.error(t('settings.errors.emptyPath'));
            return;
        }

        if (newBrewPath === brewPath) {
            toast.success(t('settings.messages.noChanges'));
            return;
        }

        try {
            setSaving(true);
            await SetBrewPath(newBrewPath.trim());
            setBrewPath(newBrewPath.trim());
            toast.success(t('settings.messages.pathUpdated'));
            
            // Refresh packages after changing brew path
            onRefreshPackages();
        } catch (error) {
            console.error("Failed to set brew path:", error);
            toast.error(t('settings.errors.invalidPath'));
            // Reset to current path on error
            setNewBrewPath(brewPath);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setNewBrewPath(brewPath);
        toast.success(t('settings.messages.pathReset'));
    };

    const handleDetectPath = async () => {
        // Common brew paths for different Mac architectures
        const commonPaths = [
            "/opt/homebrew/bin/brew",              // M1 Macs (Apple Silicon)
            "/usr/local/bin/brew",                 // Intel Macs
            "/home/linuxbrew/.linuxbrew/bin/brew", // Linux (if supported)
        ];

        for (const path of commonPaths) {
            try {
                await SetBrewPath(path);
                setNewBrewPath(path);
                setBrewPath(path);
                toast.success(t('settings.messages.pathDetected', { path }));
                onRefreshPackages();
                return;
            } catch (error) {
                // Continue to next path if this one fails
                console.log(`Failed to set path ${path}:`, error);
            }
        }

        toast.error(t('settings.errors.autoDetectionFailed'));
    };

    if (loading) {
        return (
            <div className="settings-container">
                <div className="header-row">
                    <div className="header-title">
                        <h3>{t('settings.title')}</h3>
                    </div>
                </div>
                <div className="settings-content">
                    <div className="loading-message">{t('settings.loading')}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-container">
            <div className="header-row">
                <div className="header-title">
                    <h3>{t('settings.title')}</h3>
                </div>
            </div>
            
            <div className="settings-content">
                <div className="settings-category">
                    <div className="settings-category-header-static">
                        <h3 className="category-title-static">
                            {t('settings.categories.general')}
                        </h3>
                    </div>
                    
                    <div className="settings-items-list">
                        <div className="settings-item">
                            <button 
                                className="settings-item-header"
                                onClick={() => setIsBrewPathExpanded(!isBrewPathExpanded)}
                                aria-expanded={isBrewPathExpanded}
                                aria-controls="brew-path-settings-content"
                            >
                                <div className="settings-item-info">
                                    <h4 className="settings-item-title">{t('settings.brewPath.title')}</h4>
                                    <p className="settings-item-subtitle">{brewPath}</p>
                                </div>
                                <span className={`settings-item-icon ${isBrewPathExpanded ? 'expanded' : ''}`}>
                                    ▶
                                </span>
                            </button>
                            
                            <div 
                                id="brew-path-settings-content"
                                className={`settings-item-content ${isBrewPathExpanded ? 'expanded' : 'collapsed'}`}
                            >
                                <div className="settings-item-description">
                                    {t('settings.brewPath.description')}
                                </div>
                                
                                <div className="settings-field-group">
                                    <div className="settings-field">
                                        <label htmlFor="brew-path" className="field-label">
                                            {t('settings.brewPath.currentPath')}
                                        </label>
                                        <div className="path-input-container">
                                            <input
                                                id="brew-path"
                                                type="text"
                                                value={newBrewPath}
                                                onChange={(e) => setNewBrewPath(e.target.value)}
                                                className="path-input"
                                                placeholder={t('settings.brewPath.placeholder')}
                                                disabled={saving}
                                            />
                                            <button
                                                className="detect-button"
                                                onClick={handleDetectPath}
                                                disabled={saving}
                                                title={t('settings.brewPath.autoDetect')}
                                            >
                                                🔍
                                            </button>
                                        </div>
                                    </div>

                                    <div className="settings-actions">
                                        <button
                                            className="save-button"
                                            onClick={handleSave}
                                            disabled={saving || newBrewPath.trim() === ""}
                                        >
                                            {saving ? t('settings.buttons.saving') : t('settings.buttons.save')}
                                        </button>
                                        <button
                                            className="reset-button"
                                            onClick={handleReset}
                                            disabled={saving || newBrewPath === brewPath}
                                        >
                                            {t('settings.buttons.reset')}
                                        </button>
                                    </div>
                                </div>

                                <div className="settings-info-panel">
                                    <div className="current-path-info">
                                        <span className="info-label">{t('settings.brewPath.currentlyUsing')}</span>
                                        <code className="current-path">{brewPath}</code>
                                    </div>
                                    <p className="settings-note">
                                        💡 {t('settings.brewPath.note')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
