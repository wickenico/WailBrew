import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { ServiceEntry } from "./ServicesTable";

interface ServiceInfoProps {
    service: ServiceEntry | null;
}

const ServiceInfo: React.FC<ServiceInfoProps> = ({ service }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    // Reset the copied indicator when the selected service changes.
    useEffect(() => {
        setCopied(false);
    }, [service?.name, service?.pid]);

    if (!service) {
        return <p><strong>{t("services.noSelection")}</strong></p>;
    }

    const known = ["started", "stopped", "error", "scheduled", "none", "other", "unknown"];
    const statusLabel = known.includes(service.status)
        ? t(`services.status.${service.status}`)
        : service.status;

    const handleCopyPid = async () => {
        if (!service.pid) return;
        try {
            await navigator.clipboard.writeText(String(service.pid));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success(t("services.pidCopied"), {
                duration: 2000,
                position: "bottom-center",
            });
        } catch (err) {
            console.error("Failed to copy PID:", err);
            toast.error(t("logDialog.copyFailed"), {
                duration: 2000,
                position: "bottom-center",
            });
        }
    };

    return (
        <>
            <p><strong>{service.name}</strong></p>
            <p>{t("services.statusLabel")}: {statusLabel || t("common.notAvailable")}</p>
            <p>{t("services.user")}: {service.user || t("common.notAvailable")}</p>
            {service.status === "started" && service.pid ? (
                <p style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {t("services.pid")}: {service.pid}
                    <button
                        type="button"
                        className="pid-copy-button"
                        onClick={handleCopyPid}
                        title={copied ? t("services.pidCopied") : t("services.copyPid")}
                        aria-label={copied ? t("services.pidCopied") : t("services.copyPid")}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "2px",
                            color: copied ? "#3ba55d" : "inherit",
                            opacity: copied ? 1 : 0.7,
                        }}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </p>
            ) : null}
        </>
    );
};

export default ServiceInfo;
