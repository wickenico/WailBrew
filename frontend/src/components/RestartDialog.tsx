import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { RestartApp } from '../../wailsjs/go/main/App';

interface RestartDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const RestartDialog: React.FC<RestartDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  const handleRestart = async () => {
    try {
      await RestartApp();
    } catch (err) {
      console.error('Failed to restart app:', err);
    }
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="about-overlay" 
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="dialog"
      tabIndex={-1}
    >
      <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="about-header">
          <h2>{t('restartDialog.title')}</h2>
        </div>
        
        <div className="about-content">
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <CheckCircle2 size={64} color="#4CAF50" strokeWidth={2} />
            </div>
            <h3>{t('restartDialog.message')}</h3>
            <p style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
              {t('restartDialog.description')}
            </p>
          </div>
        </div>
        
        <div className="about-footer">
          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={onClose}>
              {t('restartDialog.later')}
            </button>
            <button className="btn btn-primary" onClick={handleRestart}>
              {t('restartDialog.restartNow')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestartDialog;

