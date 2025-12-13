import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import packageJson from '../../package.json';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal = ({ isOpen, onClose }: AboutModalProps) => {
  const { t } = useTranslation();
  const [clickCount, setClickCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // モーダルが閉じられたらカウントをリセット
  useEffect(() => {
    if (!isOpen) {
      setClickCount(0);
      setShowHint(false);
    }
  }, [isOpen]);

  const handleVersionClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    // 3回目: アニメーション
    if (newCount === 3) {
      // モバイルの場合は振動
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
    
    // 5回目: ヒント表示
    if (newCount === 5) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 2000);
    }
    
    // 7回目: デバッグモード有効化
    if (newCount === 7) {
      const isCurrentlyEnabled = localStorage.getItem('debugModeEnabled') === 'true';
      
      if (!isCurrentlyEnabled) {
        // 無効→有効化
        localStorage.setItem('debugModeEnabled', 'true');
        setToastMessage('デバッグモードが有効になりました');
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
          setClickCount(0);
          onClose();
          // ページをリロードしてメニューを更新
          window.location.reload();
        }, 2000);
      } else {
        // 既に有効の場合はヒントを表示
        setToastMessage('さらに3回クリックで無効化');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    }
    
    // 10回目: デバッグモード無効化
    if (newCount === 10) {
      localStorage.removeItem('debugModeEnabled');
      setToastMessage('デバッグモードが無効になりました');
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        setClickCount(0);
        onClose();
        // ページをリロードしてメニューを更新
        window.location.reload();
      }, 2000);
    }
  };

  if (!isOpen) return null;

  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};

  return (
    <>
      {/* トースト通知 */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg z-[60] animate-fade-in">
          {toastMessage}
        </div>
      )}
      
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div role="dialog" aria-modal="true" className="rounded-lg shadow-xl w-full max-w-[500px] max-h-[85vh] flex flex-col bg-card border border-border">
          <div className="flex flex-col items-center justify-center p-6 border-b border-border bg-card relative">
            <div className="flex flex-col items-center">
                <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-green-800 drop-shadow-sm tracking-wider" style={{ fontFamily: '"Cinzel Decorative", cursive', lineHeight: '0.8' }}>
                    ARKHAM
                </h1>
                <span className="text-[0.8rem] tracking-widest mt-2 text-muted-foreground">
                    <span className="text-purple-500 font-bold">A</span>dventure <span className="text-purple-500 font-bold">R</span>outing & <span className="text-purple-500 font-bold">K</span>eeper <span className="text-purple-500 font-bold">H</span>andling <span className="text-purple-500 font-bold">A</span>ssistant <span className="text-purple-500 font-bold">M</span>anager
                </span>
                <div className="mt-4 text-xs text-muted-foreground">
                    © {new Date().getFullYear()} c-ardinal
                </div>
            </div>
            <button onClick={onClose} className="absolute top-4 right-4 hover:text-muted-foreground text-muted-foreground/80">
              <X size={24} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto space-y-6 text-muted-foreground">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Version</h3>
              <p 
                className={`font-mono select-none transition-all ${
                  clickCount >= 3 ? 'animate-pulse' : ''
                }`}
                onClick={handleVersionClick}
              >
                {packageJson.version}
              </p>
              {/* ヒント表示 */}
              {showHint && (
                <div className="text-sm text-muted-foreground mt-2 animate-fade-in">
                  あと{7 - clickCount}回...
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Libraries</h3>
              <div className="space-y-4">
                  <div>
                      <h4 className="font-medium mb-1 text-sm opacity-80">Dependencies</h4>
                      <ul className="text-sm font-mono space-y-1">
                          {Object.entries(dependencies).map(([name, version]) => (
                              <li key={name} className="flex justify-between">
                                  <span>{name}</span>
                                  <span className="opacity-70">{version as string}</span>
                              </li>
                          ))}
                      </ul>
                  </div>
                  <div>
                      <h4 className="font-medium mb-1 text-sm opacity-80">Dev Dependencies</h4>
                      <ul className="text-sm font-mono space-y-1">
                          {Object.entries(devDependencies).map(([name, version]) => (
                              <li key={name} className="flex justify-between">
                                  <span>{name}</span>
                                  <span className="opacity-70">{version as string}</span>
                              </li>
                          ))}
                      </ul>
                  </div>
              </div>
            </div>
          </div>
          <div className="p-4 border-t flex justify-end border-border">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded transition-colors bg-secondary hover:bg-secondary/80 text-secondary-foreground"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
