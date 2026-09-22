import { ChevronRight, FolderOpen, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
    GetConfigDirectory,
    IsConfigDirectoryOverridden,
    MoveConfigDirectory,
    SelectConfigDirectory,
} from "../../wailsjs/go/main/App";

export default function ConfigDirectorySetting() {
    const { t } = useTranslation();
    const [directory, setDirectory] = useState("");
    const [selected, setSelected] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [overridden, setOverridden] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        Promise.all([GetConfigDirectory(), IsConfigDirectoryOverridden()])
            .then(([path, override]) => {
                setDirectory(path);
                setSelected(path);
                setOverridden(override);
                setReady(true);
            })
            .catch((error) => toast.error(String(error)));
    }, []);

    const choose = async () => {
        setBusy(true);
        try {
            const path = await SelectConfigDirectory();
            if (path) setSelected(path);
        } catch (error) {
            toast.error(String(error));
        } finally {
            setBusy(false);
        }
    };

    const move = async () => {
        setBusy(true);
        try {
            const warning = await MoveConfigDirectory(selected);
            const path = await GetConfigDirectory();
            setDirectory(path);
            setSelected(path);
            if (warning) toast(warning, { duration: 8000 });
            else toast.success(t("settings.configDirectory.moved"));
        } catch (error) {
            toast.error(String(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`settings-card ${expanded ? "expanded" : ""}`}>
            <button
                type="button"
                className="settings-card-header"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
            >
                <div className="settings-card-icon">
                    <FolderOpen size={20} />
                </div>
                <div className="settings-card-info">
                    <h3>{t("settings.configDirectory.title")}</h3>
                    <span className="settings-card-value" title={directory}>
                        {directory}
                    </span>
                </div>
                <ChevronRight className={`settings-card-chevron ${expanded ? "rotated" : ""}`} size={20} />
            </button>
            <div className={`settings-card-content ${expanded ? "show" : ""}`}>
                <p className="settings-card-description">{t("settings.configDirectory.description")}</p>
                {overridden && <p className="settings-info-box">{t("settings.configDirectory.overridden")}</p>}
                <div className="settings-input-group">
                    <label htmlFor="settings-config-directory">{t("settings.configDirectory.folder")}</label>
                    <div className="settings-input-row">
                        <input id="settings-config-directory" value={selected} readOnly />
                        <button
                            type="button"
                            className="settings-icon-btn"
                            onClick={choose}
                            disabled={!ready || busy || overridden}
                            title={t("settings.configDirectory.choose")}
                            aria-label={t("settings.configDirectory.choose")}
                        >
                            <FolderOpen size={18} />
                        </button>
                    </div>
                </div>
                <div className="settings-card-actions">
                    <button
                        type="button"
                        className="settings-btn-secondary"
                        onClick={() => setSelected(directory)}
                        disabled={busy || selected === directory}
                    >
                        {t("settings.buttons.reset")}
                    </button>
                    <button
                        type="button"
                        className="settings-btn-primary"
                        onClick={move}
                        disabled={!ready || busy || overridden || !selected || selected === directory}
                    >
                        {busy && <Loader2 className="spin" size={16} />}
                        {t(busy ? "settings.configDirectory.moving" : "settings.configDirectory.move")}
                    </button>
                </div>
            </div>
        </div>
    );
}
