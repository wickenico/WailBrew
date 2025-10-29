import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HardDrive } from "lucide-react";

interface CleanupViewProps {
    cleanupLog: string;
    cleanupEstimate: string;
    onClearLog: () => void;
    onRunCleanup: () => void;
    onCheckEstimate: () => void;
}

const CleanupView: React.FC<CleanupViewProps> = ({ cleanupLog, cleanupEstimate, onClearLog, onRunCleanup, onCheckEstimate }) => {
    const { t } = useTranslation();
    
    // Check estimate when component mounts
    useEffect(() => {
        onCheckEstimate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Format the estimate display
    const displaySize = cleanupEstimate && cleanupEstimate !== "0B" 
        ? cleanupEstimate 
        : "0 MB";
    
    return (
        <>
            <div className="header-row">
                <div className="header-title">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {t('headers.homebrewCleanup')}
                        <span style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#EF4444',
                            marginLeft: '8px'
                        }}>
                            <HardDrive size={16} />
                            {t('cleanup.spaceToFree', { size: displaySize })}
                        </span>
                    </h3>
                </div>
                <div className="header-actions">
                    <button className="doctor-button" onClick={onClearLog}>
                        {t('buttons.clearLog')}
                    </button>
                    <button className="doctor-button" onClick={onRunCleanup}>
                        {t('buttons.runCleanup')}
                    </button>
                </div>
            </div>
            <pre className="doctor-log">
                {cleanupLog || t('dialogs.noCleanupOutput')}
            </pre>
            <div className="package-footer">
                {t('footers.cleanup')}
            </div>
        </>
    );
};

export default CleanupView;
