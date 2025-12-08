import { X } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';


interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualModal = ({ isOpen, onClose }: ManualModalProps) => {
  const { t, tf } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-lg shadow-xl w-full max-w-[800px] max-h-[85vh] flex flex-col bg-card border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold text-card-foreground">{t('manual.title')}</h2>
          <button onClick={onClose} className="hover:text-muted-foreground text-muted-foreground/80">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6 text-muted-foreground">
          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t('manual.introduction')}</h3>
            <p>{tf('manual.introText')}</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t('manual.glossary')}</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
                <li>{tf('manual.glossaryNode')}</li>
                <li>{tf('manual.glossaryHandle')}</li>
                <li>{tf('manual.glossaryEdge')}</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t('manual.nodes')}</h3>
            <ul className="list-disc list-outside space-y-3 ml-6">
              <li><strong>{t('nodes.event')}:</strong> {tf('manual.eventNodeDesc')}</li>
              <li><strong>{t('nodes.element')}:</strong> {tf('manual.infoNodeDesc')}</li>
              <li><strong>{t('nodes.branch')}:</strong> {tf('manual.branchNodeDesc')}</li>
              <li><strong>{t('nodes.variable')}:</strong> {tf('manual.variableNodeDesc')}</li>
              <li><strong>{t('nodes.group')}:</strong> {tf('manual.groupNodeDesc')}</li>
              <li><strong>{t('nodes.jump')}:</strong> {tf('manual.jumpNodeDesc')}</li>
              <li><strong>{t('nodes.memo')}:</strong> {tf('manual.memoNodeDesc')}</li>
              <li><strong>{t('menu.bulkStickyOperations')} (Sticky):</strong> {tf('manual.stickyNodeDesc')}</li>
            </ul>
            <h4 className="font-semibold mt-4 mb-2 text-primary">{t('menu.file')} / {t('characters.title')} & {t('resources.title')}</h4>
            <ul className="list-disc list-outside space-y-3 ml-6">
              <li><strong>{t('resources.title')} (Ref):</strong> {tf('manual.resourceNodeDesc')}</li>
              <li><strong>{t('characters.title')} (Ref):</strong> {tf('manual.characterNodeDesc')}</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t('manual.controls')}</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
                <li>{tf('manual.controlsDesc1')}</li>
                <li>{tf('manual.controlsDesc2')}</li>
                <li>{tf('manual.controlsDesc3')}</li>
                <li>{tf('manual.controlsDesc4')}</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t('manual.modesTitle')}</h3>
            <div className="space-y-4">
                <div>
                    <h4 className="font-bold mb-1">{t('manual.editModeTitle')}</h4>
                    <p className="ml-2">{tf('manual.editModeDesc')}</p>
                </div>
                <div>
                    <h4 className="font-bold mb-1">{t('manual.playModeTitle')}</h4>
                    <p className="ml-2">{tf('manual.playModeDesc')}</p>
                </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t('manual.variablesTitle')}</h3>
            <p>{tf('manual.variablesDesc')}</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t('manual.shortcutsTitle')}</h3>
            <p>{tf('manual.shortcutsDesc')}</p>
          </section>

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
  );
};
