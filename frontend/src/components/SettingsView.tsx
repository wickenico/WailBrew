import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
    Settings, 
    Terminal, 
    Globe, 
    RefreshCw, 
    FolderOpen,
    ChevronRight,
    Search,
    Check,
    RotateCcw,
    Loader2,
    Info,
    Sparkles
} from "lucide-react";
import { GetBrewPath, SetBrewPath, GetMirrorSource, SetMirrorSource, GetOutdatedFlag, SetOutdatedFlag, GetCaskAppDir, SetCaskAppDir, SelectCaskAppDir } from "../../wailsjs/go/main/App";
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
    const [isOutdatedFlagExpanded, setIsOutdatedFlagExpanded] = useState<boolean>(false);
    const [isCaskAppDirExpanded, setIsCaskAppDirExpanded] = useState<boolean>(false);
    const [mirrorSource, setMirrorSource] = useState<string>("official");
    const [customGitRemote, setCustomGitRemote] = useState<string>("");
    const [customBottleDomain, setCustomBottleDomain] = useState<string>("");
    const [savingMirror, setSavingMirror] = useState<boolean>(false);
    const [outdatedFlag, setOutdatedFlag] = useState<string>("greedy-auto-updates");
    const [newOutdatedFlag, setNewOutdatedFlag] = useState<string>("greedy-auto-updates");
    const [savingOutdatedFlag, setSavingOutdatedFlag] = useState<boolean>(false);
    const [caskAppDir, setCaskAppDir] = useState<string>("");
    const [newCaskAppDir, setNewCaskAppDir] = useState<string>("");
    const [savingCaskAppDir, setSavingCaskAppDir] = useState<boolean>(false);

    useEffect(() => {
        loadCurrentBrewPath();
        loadCurrentMirrorSource();
        loadCurrentOutdatedFlag();
        loadCurrentCaskAppDir();
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
            onRefreshPackages();
        } catch (error) {
            console.error("Failed to set brew path:", error);
            toast.error(t('settings.errors.invalidPath'));
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
        const commonPaths = [
            "/opt/workbrew/bin/brew",
            "/opt/homebrew/bin/brew",
            "/usr/local/bin/brew",
            "/home/linuxbrew/.linuxbrew/bin/brew",
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
        if (sourceId !== "custom") {
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

    const loadCurrentOutdatedFlag = async () => {
        try {
            const currentFlag = await GetOutdatedFlag();
            setOutdatedFlag(currentFlag);
            setNewOutdatedFlag(currentFlag);
        } catch (error) {
            console.error("Failed to get outdated flag:", error);
        }
    };

    const handleSaveOutdatedFlag = async () => {
        if (newOutdatedFlag === outdatedFlag) {
            toast.success(t('settings.messages.noChanges'));
            return;
        }

        try {
            setSavingOutdatedFlag(true);
            await SetOutdatedFlag(newOutdatedFlag);
            setOutdatedFlag(newOutdatedFlag);
            toast.success(t('settings.messages.outdatedFlagUpdated'));
            onRefreshPackages();
        } catch (error) {
            console.error("Failed to set outdated flag:", error);
            toast.error(t('settings.errors.failedToSetOutdatedFlag'));
            setNewOutdatedFlag(outdatedFlag);
        } finally {
            setSavingOutdatedFlag(false);
        }
    };

    const handleResetOutdatedFlag = () => {
        setNewOutdatedFlag(outdatedFlag);
        toast.success(t('settings.messages.outdatedFlagReset'));
    };

    const getOutdatedFlagLabel = (flag: string) => {
        switch (flag) {
            case "none":
                return t('settings.outdatedFlag.options.none');
            case "greedy":
                return t('settings.outdatedFlag.options.greedy');
            case "greedy-auto-updates":
                return t('settings.outdatedFlag.options.greedyAutoUpdates');
            default:
                return flag;
        }
    };

    const loadCurrentCaskAppDir = async () => {
        try {
            const currentDir = await GetCaskAppDir();
            setCaskAppDir(currentDir);
            setNewCaskAppDir(currentDir);
        } catch (error) {
            console.error("Failed to get cask app directory:", error);
            setCaskAppDir("");
            setNewCaskAppDir("");
        }
    };

    const handleSaveCaskAppDir = async () => {
        const trimmedDir = newCaskAppDir.trim();
        if (trimmedDir === caskAppDir) {
            toast.success(t('settings.messages.noChanges'));
            return;
        }

        try {
            setSavingCaskAppDir(true);
            await SetCaskAppDir(trimmedDir);
            setCaskAppDir(trimmedDir);
            setNewCaskAppDir(trimmedDir);
            toast.success(t('settings.messages.caskAppDirUpdated'));
            onRefreshPackages();
        } catch (error) {
            console.error("Failed to set cask app directory:", error);
            toast.error(t('settings.errors.failedToSetCaskAppDir'));
            setNewCaskAppDir(caskAppDir);
        } finally {
            setSavingCaskAppDir(false);
        }
    };

    const handleResetCaskAppDir = () => {
        setNewCaskAppDir(caskAppDir);
    };

    const handleSelectCaskAppDir = async () => {
        try {
            const selectedDir = await SelectCaskAppDir();
            if (selectedDir) {
                setNewCaskAppDir(selectedDir);
            }
        } catch (error) {
            console.error("Failed to select directory:", error);
            toast.error(t('settings.errors.failedToSelectDirectory'));
        }
    };

    const getMirrorDisplayName = () => {
        if (mirrorSource === "official") {
            return t('settings.mirrorSource.mirrors.official');
        }
        if (mirrorSource === "custom") {
            return t('settings.mirrorSource.custom');
        }
        return getKnownMirrors().find(m => m.id === mirrorSource)?.name || "";
    };

    if (loading) {
        return (
            <div className="settings-view-modern">
                <div className="settings-header-modern">
                    <div className="settings-header-icon">
                        <Settings size={28} />
                    </div>
                    <div className="settings-header-text">
                        <h2>{t('settings.title')}</h2>
                        <p>{t('settings.loading')}</p>
                    </div>
                </div>
                <div className="settings-loading">
                    <Loader2 className="spin" size={32} />
                </div>
            </div>
        );
    }

    return (
        <div className="settings-view-modern">
            <div className="settings-header-modern">
                <div className="settings-header-icon">
                    <Settings size={28} />
                </div>
                <div className="settings-header-text">
                    <h2>{t('settings.title')}</h2>
                    <p>{t('settings.subtitle') || 'Configure your Homebrew experience'}</p>
                </div>
            </div>

            <div className="settings-cards-container">
                {/* Brew Path Card */}
                <div className={`settings-card ${isBrewPathExpanded ? 'expanded' : ''}`}>
                    <button 
                        className="settings-card-header"
                        onClick={() => setIsBrewPathExpanded(!isBrewPathExpanded)}
                        aria-expanded={isBrewPathExpanded}
                    >
                        <div className="settings-card-icon">
                            <Terminal size={20} />
                        </div>
                        <div className="settings-card-info">
                            <h3>{t('settings.brewPath.title')}</h3>
                            <span className="settings-card-value">{brewPath}</span>
                        </div>
                        <ChevronRight className={`settings-card-chevron ${isBrewPathExpanded ? 'rotated' : ''}`} size={20} />
                    </button>
                    
                    <div className={`settings-card-content ${isBrewPathExpanded ? 'show' : ''}`}>
                        <p className="settings-card-description">
                            {t('settings.brewPath.description')}
                        </p>
                        
                        <div className="settings-input-group">
                            <label>{t('settings.brewPath.currentPath')}</label>
                            <div className="settings-input-row">
                                <input
                                    type="text"
                                    value={newBrewPath}
                                    onChange={(e) => setNewBrewPath(e.target.value)}
                                    placeholder={t('settings.brewPath.placeholder')}
                                    disabled={saving}
                                />
                                <button
                                    className="settings-icon-btn"
                                    onClick={handleDetectPath}
                                    disabled={saving}
                                    title={t('settings.brewPath.autoDetect')}
                                >
                                    <Search size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="settings-info-box">
                            <Info size={16} />
                            <span>{t('settings.brewPath.note')}</span>
                        </div>

                        <div className="settings-card-actions">
                            <button
                                className="settings-btn-secondary"
                                onClick={handleReset}
                                disabled={saving || newBrewPath === brewPath}
                            >
                                <RotateCcw size={16} />
                                {t('settings.buttons.reset')}
                            </button>
                            <button
                                className="settings-btn-primary"
                                onClick={handleSave}
                                disabled={saving || newBrewPath.trim() === ""}
                            >
                                {saving ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                                {saving ? t('settings.buttons.saving') : t('settings.buttons.save')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mirror Source Card */}
                <div className={`settings-card ${isMirrorSourceExpanded ? 'expanded' : ''}`}>
                    <button 
                        className="settings-card-header"
                        onClick={() => setIsMirrorSourceExpanded(!isMirrorSourceExpanded)}
                        aria-expanded={isMirrorSourceExpanded}
                    >
                        <div className="settings-card-icon">
                            <Globe size={20} />
                        </div>
                        <div className="settings-card-info">
                            <h3>
                                {t('settings.mirrorSource.title')}
                                <span className="settings-badge">BETA</span>
                            </h3>
                            <span className="settings-card-value">{getMirrorDisplayName()}</span>
                        </div>
                        <ChevronRight className={`settings-card-chevron ${isMirrorSourceExpanded ? 'rotated' : ''}`} size={20} />
                    </button>
                    
                    <div className={`settings-card-content ${isMirrorSourceExpanded ? 'show' : ''}`}>
                        <p className="settings-card-description">
                            {t('settings.mirrorSource.description')}
                        </p>
                        
                        <div className="settings-input-group">
                            <label>{t('settings.mirrorSource.selectMirror')}</label>
                            <select
                                value={mirrorSource}
                                onChange={(e) => handleMirrorSourceChange(e.target.value)}
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
                            <div className="settings-custom-fields">
                                <div className="settings-input-group">
                                    <label>{t('settings.mirrorSource.customGitRemote')}</label>
                                    <input
                                        type="text"
                                        value={customGitRemote}
                                        onChange={(e) => setCustomGitRemote(e.target.value)}
                                        placeholder="https://mirrors.example.com/git/homebrew/brew.git"
                                        disabled={savingMirror}
                                    />
                                </div>
                                <div className="settings-input-group">
                                    <label>{t('settings.mirrorSource.customBottleDomain')}</label>
                                    <input
                                        type="text"
                                        value={customBottleDomain}
                                        onChange={(e) => setCustomBottleDomain(e.target.value)}
                                        placeholder="https://mirrors.example.com/homebrew-bottles"
                                        disabled={savingMirror}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="settings-info-box">
                            <Info size={16} />
                            <span>{t('settings.mirrorSource.note')}</span>
                        </div>

                        <div className="settings-card-actions">
                            <button
                                className="settings-btn-secondary"
                                onClick={handleResetMirrorSource}
                                disabled={savingMirror}
                            >
                                <RotateCcw size={16} />
                                {t('settings.buttons.reset')}
                            </button>
                            <button
                                className="settings-btn-primary"
                                onClick={handleSaveMirrorSource}
                                disabled={savingMirror}
                            >
                                {savingMirror ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                                {savingMirror ? t('settings.buttons.saving') : t('settings.buttons.save')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Outdated Detection Card */}
                <div className={`settings-card ${isOutdatedFlagExpanded ? 'expanded' : ''}`}>
                    <button 
                        className="settings-card-header"
                        onClick={() => setIsOutdatedFlagExpanded(!isOutdatedFlagExpanded)}
                        aria-expanded={isOutdatedFlagExpanded}
                    >
                        <div className="settings-card-icon">
                            <RefreshCw size={20} />
                        </div>
                        <div className="settings-card-info">
                            <h3>{t('settings.outdatedFlag.title')}</h3>
                            <span className="settings-card-value">{getOutdatedFlagLabel(outdatedFlag)}</span>
                        </div>
                        <ChevronRight className={`settings-card-chevron ${isOutdatedFlagExpanded ? 'rotated' : ''}`} size={20} />
                    </button>
                    
                    <div className={`settings-card-content ${isOutdatedFlagExpanded ? 'show' : ''}`}>
                        <p className="settings-card-description">
                            {t('settings.outdatedFlag.description')}
                        </p>
                        
                        <div className="settings-input-group">
                            <label>{t('settings.outdatedFlag.selectFlag')}</label>
                            <select
                                value={newOutdatedFlag}
                                onChange={(e) => setNewOutdatedFlag(e.target.value)}
                                disabled={savingOutdatedFlag}
                            >
                                <option value="none">{t('settings.outdatedFlag.options.none')}</option>
                                <option value="greedy">{t('settings.outdatedFlag.options.greedy')}</option>
                                <option value="greedy-auto-updates">{t('settings.outdatedFlag.options.greedyAutoUpdates')}</option>
                            </select>
                        </div>

                        <div className="settings-option-hint">
                            {newOutdatedFlag === "none" && t('settings.outdatedFlag.descriptions.none')}
                            {newOutdatedFlag === "greedy" && t('settings.outdatedFlag.descriptions.greedy')}
                            {newOutdatedFlag === "greedy-auto-updates" && t('settings.outdatedFlag.descriptions.greedyAutoUpdates')}
                        </div>

                        <div className="settings-info-box">
                            <Info size={16} />
                            <span>{t('settings.outdatedFlag.note')}</span>
                        </div>

                        <div className="settings-card-actions">
                            <button
                                className="settings-btn-secondary"
                                onClick={handleResetOutdatedFlag}
                                disabled={savingOutdatedFlag || newOutdatedFlag === outdatedFlag}
                            >
                                <RotateCcw size={16} />
                                {t('settings.buttons.reset')}
                            </button>
                            <button
                                className="settings-btn-primary"
                                onClick={handleSaveOutdatedFlag}
                                disabled={savingOutdatedFlag || newOutdatedFlag === outdatedFlag}
                            >
                                {savingOutdatedFlag ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                                {savingOutdatedFlag ? t('settings.buttons.saving') : t('settings.buttons.save')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Cask App Directory Card */}
                <div className={`settings-card ${isCaskAppDirExpanded ? 'expanded' : ''}`}>
                    <button 
                        className="settings-card-header"
                        onClick={() => setIsCaskAppDirExpanded(!isCaskAppDirExpanded)}
                        aria-expanded={isCaskAppDirExpanded}
                    >
                        <div className="settings-card-icon">
                            <FolderOpen size={20} />
                        </div>
                        <div className="settings-card-info">
                            <h3>{t('settings.caskAppDir.title')}</h3>
                            <span className="settings-card-value">{caskAppDir || t('settings.caskAppDir.default')}</span>
                        </div>
                        <ChevronRight className={`settings-card-chevron ${isCaskAppDirExpanded ? 'rotated' : ''}`} size={20} />
                    </button>
                    
                    <div className={`settings-card-content ${isCaskAppDirExpanded ? 'show' : ''}`}>
                        <p className="settings-card-description">
                            {t('settings.caskAppDir.description')}
                        </p>
                        
                        <div className="settings-input-group">
                            <label>{t('settings.caskAppDir.currentDir')}</label>
                            <div className="settings-input-row">
                                <input
                                    type="text"
                                    value={newCaskAppDir || t('settings.caskAppDir.default')}
                                    readOnly
                                    disabled={savingCaskAppDir}
                                />
                                <button
                                    className="settings-icon-btn"
                                    onClick={handleSelectCaskAppDir}
                                    disabled={savingCaskAppDir}
                                    title={t('settings.caskAppDir.selectDirectory')}
                                >
                                    <FolderOpen size={18} />
                                </button>
                            </div>
                        </div>

                        {newCaskAppDir !== caskAppDir && (
                            <div className="settings-preview-box">
                                <Sparkles size={16} />
                                <span>{t('settings.caskAppDir.newDirectory')}: <code>{newCaskAppDir || t('settings.caskAppDir.default')}</code></span>
                            </div>
                        )}

                        <div className="settings-info-box">
                            <Info size={16} />
                            <span>{t('settings.caskAppDir.note')}</span>
                        </div>

                        <div className="settings-card-actions">
                            <button
                                className="settings-btn-secondary"
                                onClick={handleResetCaskAppDir}
                                disabled={savingCaskAppDir || newCaskAppDir === caskAppDir}
                            >
                                <RotateCcw size={16} />
                                {t('settings.buttons.reset')}
                            </button>
                            <button
                                className="settings-btn-primary"
                                onClick={handleSaveCaskAppDir}
                                disabled={savingCaskAppDir || newCaskAppDir.trim() === caskAppDir}
                            >
                                {savingCaskAppDir ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                                {savingCaskAppDir ? t('settings.buttons.saving') : t('settings.buttons.save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
