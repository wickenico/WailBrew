import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GetBrewPath, SetBrewPath, GetMirrorSource, SetMirrorSource } from "../../wailsjs/go/main/App";
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
    const [isMirrorSourceExpanded, setIsMirrorSourceExpanded] = useState<boolean>(false);
    const [mirrorSource, setMirrorSource] = useState<string>("official");
    const [customGitRemote, setCustomGitRemote] = useState<string>("");
    const [customBottleDomain, setCustomBottleDomain] = useState<string>("");
    const [savingMirror, setSavingMirror] = useState<boolean>(false);

    useEffect(() => {
        loadCurrentBrewPath();
        loadCurrentMirrorSource();
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

    const loadCurrentMirrorSource = async () => {
        try {
            const currentMirror = await GetMirrorSource();
            if (currentMirror.gitRemote === "" && currentMirror.bottleDomain === "") {
                setMirrorSource("official");
                setCustomGitRemote("");
                setCustomBottleDomain("");
            } else {
                // Check if it matches a known mirror
                const knownMirrors = getKnownMirrors();
                const foundMirror = knownMirrors.find(m => 
                    m.gitRemote === currentMirror.gitRemote && 
                    m.bottleDomain === currentMirror.bottleDomain
                );
                if (foundMirror) {
                    setMirrorSource(foundMirror.id);
                    setCustomGitRemote("");
                    setCustomBottleDomain("");
                } else {
                    setMirrorSource("custom");
                    setCustomGitRemote(currentMirror.gitRemote || "");
                    setCustomBottleDomain(currentMirror.bottleDomain || "");
                }
            }
        } catch (error) {
            console.error("Failed to get mirror source:", error);
        }
    };

    const getKnownMirrors = () => {
        return [
            {
                id: "official",
                name: t('settings.mirrorSource.mirrors.official'),
                gitRemote: "",
                bottleDomain: ""
            },
            {
                id: "tsinghua",
                name: t('settings.mirrorSource.mirrors.tsinghua'),
                gitRemote: "https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git",
                bottleDomain: "https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
            },
            {
                id: "aliyun",
                name: t('settings.mirrorSource.mirrors.aliyun'),
                gitRemote: "https://mirrors.aliyun.com/homebrew/brew.git",
                bottleDomain: "https://mirrors.aliyun.com/homebrew/homebrew-bottles"
            },
            {
                id: "ustc",
                name: t('settings.mirrorSource.mirrors.ustc'),
                gitRemote: "https://mirrors.ustc.edu.cn/brew.git",
                bottleDomain: "https://mirrors.ustc.edu.cn/homebrew-bottles"
            },
            {
                id: "tencent",
                name: t('settings.mirrorSource.mirrors.tencent'),
                gitRemote: "https://mirrors.cloud.tencent.com/homebrew/brew.git",
                bottleDomain: "https://mirrors.cloud.tencent.com/homebrew/homebrew-bottles"
            }
        ];
    };

    const handleMirrorSourceChange = (sourceId: string) => {
        setMirrorSource(sourceId);
        if (sourceId === "custom") {
            // Keep custom values
        } else {
            const mirrors = getKnownMirrors();
            const selectedMirror = mirrors.find(m => m.id === sourceId);
            if (selectedMirror) {
                setCustomGitRemote(selectedMirror.gitRemote);
                setCustomBottleDomain(selectedMirror.bottleDomain);
            }
        }
    };

    const handleSaveMirrorSource = async () => {
        try {
            setSavingMirror(true);
            const mirrors = getKnownMirrors();
            const selectedMirror = mirrors.find(m => m.id === mirrorSource);
            
            let gitRemote = "";
            let bottleDomain = "";
            
            if (mirrorSource === "custom") {
                gitRemote = customGitRemote.trim();
                bottleDomain = customBottleDomain.trim();
            } else if (selectedMirror) {
                gitRemote = selectedMirror.gitRemote;
                bottleDomain = selectedMirror.bottleDomain;
            }

            await SetMirrorSource(gitRemote, bottleDomain);
            toast.success(t('settings.messages.mirrorSourceUpdated'));
            
            // Refresh packages after changing mirror source
            onRefreshPackages();
        } catch (error) {
            console.error("Failed to set mirror source:", error);
            toast.error(t('settings.errors.failedToSetMirrorSource'));
        } finally {
            setSavingMirror(false);
        }
    };

    const handleResetMirrorSource = () => {
        loadCurrentMirrorSource();
        toast.success(t('settings.messages.mirrorSourceReset'));
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

                        <div className="settings-item">
                            <button 
                                className="settings-item-header"
                                onClick={() => setIsMirrorSourceExpanded(!isMirrorSourceExpanded)}
                                aria-expanded={isMirrorSourceExpanded}
                                aria-controls="mirror-source-settings-content"
                            >
                                <div className="settings-item-info">
                                    <h4 className="settings-item-title">
                                        {t('settings.mirrorSource.title')}
                                        <span className="beta-tag">BETA</span>
                                    </h4>
                                    <p className="settings-item-subtitle">
                                        {(() => {
                                            if (mirrorSource === "official") {
                                                return t('settings.mirrorSource.mirrors.official');
                                            }
                                            if (mirrorSource === "custom") {
                                                return t('settings.mirrorSource.custom');
                                            }
                                            return getKnownMirrors().find(m => m.id === mirrorSource)?.name || "";
                                        })()}
                                    </p>
                                </div>
                                <span className={`settings-item-icon ${isMirrorSourceExpanded ? 'expanded' : ''}`}>
                                    ▶
                                </span>
                            </button>
                            
                            <div 
                                id="mirror-source-settings-content"
                                className={`settings-item-content ${isMirrorSourceExpanded ? 'expanded' : 'collapsed'}`}
                            >
                                <div className="settings-item-description">
                                    {t('settings.mirrorSource.description')}
                                </div>
                                
                                <div className="settings-field-group">
                                    <div className="settings-field">
                                        <label htmlFor="mirror-source" className="field-label">
                                            {t('settings.mirrorSource.selectMirror')}
                                        </label>
                                        <select
                                            id="mirror-source"
                                            value={mirrorSource}
                                            onChange={(e) => handleMirrorSourceChange(e.target.value)}
                                            className="mirror-select"
                                            disabled={savingMirror}
                                        >
                                            {getKnownMirrors().map(mirror => (
                                                <option key={mirror.id} value={mirror.id}>
                                                    {mirror.name}
                                                </option>
                                            ))}
                                            <option value="custom">{t('settings.mirrorSource.custom')}</option>
                                        </select>
                                    </div>

                                    {mirrorSource === "custom" && (
                                        <>
                                            <div className="settings-field">
                                                <label htmlFor="custom-git-remote" className="field-label">
                                                    {t('settings.mirrorSource.customGitRemote')}
                                                </label>
                                                <input
                                                    id="custom-git-remote"
                                                    type="text"
                                                    value={customGitRemote}
                                                    onChange={(e) => setCustomGitRemote(e.target.value)}
                                                    className="path-input"
                                                    placeholder="https://mirrors.example.com/git/homebrew/brew.git"
                                                    disabled={savingMirror}
                                                />
                                            </div>
                                            <div className="settings-field">
                                                <label htmlFor="custom-bottle-domain" className="field-label">
                                                    {t('settings.mirrorSource.customBottleDomain')}
                                                </label>
                                                <input
                                                    id="custom-bottle-domain"
                                                    type="text"
                                                    value={customBottleDomain}
                                                    onChange={(e) => setCustomBottleDomain(e.target.value)}
                                                    className="path-input"
                                                    placeholder="https://mirrors.example.com/homebrew-bottles"
                                                    disabled={savingMirror}
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div className="settings-actions">
                                        <button
                                            className="save-button"
                                            onClick={handleSaveMirrorSource}
                                            disabled={savingMirror}
                                        >
                                            {savingMirror ? t('settings.buttons.saving') : t('settings.buttons.save')}
                                        </button>
                                        <button
                                            className="reset-button"
                                            onClick={handleResetMirrorSource}
                                            disabled={savingMirror}
                                        >
                                            {t('settings.buttons.reset')}
                                        </button>
                                    </div>
                                </div>

                                <div className="settings-info-panel">
                                    <p className="settings-note">
                                        💡 {t('settings.mirrorSource.note')}
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
