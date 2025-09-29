import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckForUpdates } from '../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { main } from '../../wailsjs/go/models';

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<main.UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const checkForUpdates = async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      const info = await CheckForUpdates();
      setUpdateInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLinkClick = (url: string) => {
    BrowserOpenURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent, url: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      BrowserOpenURL(url);
    }
  };

  const copyBrewCommand = async () => {
    const command = 'brew upgrade --cask wailbrew';
    try {
      await navigator.clipboard.writeText(command);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  React.useEffect(() => {
    if (isOpen && !updateInfo) {
      checkForUpdates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-dialog update-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="about-header">
          <h2>{t('updateDialog.title')}</h2>
        </div>
        
        <div className="about-content">
          {isChecking && (
            <div className="update-checking">
              <div className="loading-spinner"></div>
              <p>{t('updateDialog.checking')}</p>
            </div>
          )}

          {error && (
            <div className="update-error">
              <div className="error-icon">⚠️</div>
              <div>
                <h3>{t('updateDialog.error')}</h3>
                <p>{error}</p>
              </div>
            </div>
          )}

          {updateInfo && !isChecking && !error && (
            <div className="update-info">
              {updateInfo.available ? (
                <div className="update-available">
                  <div className="update-icon">🎉</div>
                  <div className="update-details">
                    <h3>{t('updateDialog.available')}</h3>
                    <div className="version-comparison">
                      <div className="version-boxes">
                        <div className="version-box current">
                          <span className="version-label">{t('updateDialog.currentVersion')}</span>
                          <span className="version-number">{updateInfo.currentVersion}</span>
                        </div>
                        <div className="version-arrow">→</div>
                        <div className="version-box latest">
                          <span className="version-label">{t('updateDialog.newVersion')}</span>
                          <span className="version-number">{updateInfo.latestVersion}</span>
                        </div>
                      </div>
                      <div className="release-info">
                        <div className="release-info-item">
                          <div className="release-info-label">{t('updateDialog.published')}:</div>
                          <div className="release-info-value">{formatDate(updateInfo.publishedAt)}</div>
                        </div>
                        <div className="release-info-item">
                          <div className="release-info-label">{t('updateDialog.size')}:</div>
                          <div className="release-info-value">{formatFileSize(updateInfo.fileSize)}</div>
                        </div>
                        <div className="release-info-item">
                          <span 
                            className="clickable-link"
                            onClick={() => handleLinkClick(`https://github.com/wickenico/WailBrew/releases/tag/v${updateInfo.latestVersion}`)}
                            onKeyDown={(e) => handleKeyDown(e, `https://github.com/wickenico/WailBrew/releases/tag/v${updateInfo.latestVersion}`)}
                            role="button"
                            tabIndex={0}
                          >
                            {t('updateDialog.viewReleaseNotes')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="brew-command-section">
                      <h4>{t('updateDialog.manualUpdate')}:</h4>
                      <p className="update-instruction">{t('updateDialog.instruction')}</p>
                      <div className="command-container">
                        <code className="brew-command">brew upgrade --cask wailbrew</code>
                        <button 
                          className="copy-button"
                          onClick={copyBrewCommand}
                          title={t('updateDialog.copyCommand')}
                        >
                          {copySuccess ? '✓' : '📋'}
                        </button>
                      </div>
                      {copySuccess && (
                        <p className="copy-success">{t('updateDialog.copied')}</p>
                      )}
                    </div>

                    {updateInfo.releaseNotes && (
                      <div className="release-notes">
                        <div className="release-notes-content">
                          <h4>{t('updateDialog.changes')}:</h4>
                          {updateInfo.releaseNotes.split('\n').map((line: string, index: number) => (
                            <p key={index}>{line}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="update-current">
                  <div className="update-icon">✅</div>
                  <div>
                    <h3>{t('updateDialog.upToDate')}</h3>
                    <p>{t('updateDialog.currentVersionIs', { version: updateInfo.currentVersion })}</p>
                  </div>
                </div>
              )}
                         </div>
           )}
         </div>
         
         <div className="about-footer">
           {error ? (
             <div className="action-buttons">
               <button className="btn btn-secondary" onClick={onClose}>
                 {t('buttons.close')}
               </button>
               <button className="btn btn-primary" onClick={checkForUpdates}>
                 {t('updateDialog.tryAgain')}
               </button>
             </div>
           ) : updateInfo?.available ? (
             <div className="action-buttons">
               <button className="btn btn-secondary" onClick={onClose}>
                 {t('updateDialog.gotIt')}
               </button>
             </div>
           ) : (
             <button onClick={onClose} className="about-close-button">
               {t('buttons.close')}
             </button>
           )}
         </div>
       </div>
     </div>
   );
};

export default UpdateDialog; 