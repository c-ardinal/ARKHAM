import { X } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';


interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualModal = ({ isOpen, onClose }: ManualModalProps) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="rounded-lg shadow-xl w-[800px] max-h-[80vh] flex flex-col bg-card border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold text-card-foreground">{t.manual.title}</h2>
          <button onClick={onClose} className="hover:text-muted-foreground text-muted-foreground/80">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6 text-muted-foreground">
          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t.manual.introduction}</h3>
            <p>{t.manual.introText}</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t.manual.glossary}</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
                <li>{t.manual.glossaryNode}</li>
                <li>{t.manual.glossaryHandle}</li>
                <li>{t.manual.glossaryEdge}</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t.manual.nodes}</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong>{t.nodes.event}:</strong> {t.manual.eventNodeDesc}</li>
              <li><strong>{t.nodes.information}:</strong> {t.manual.infoNodeDesc}</li>
              <li><strong>{t.nodes.branch}:</strong> {t.manual.branchNodeDesc}</li>
              <li><strong>{t.nodes.group}:</strong> {t.manual.groupNodeDesc}</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t.manual.controls}</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
                <li>{t.manual.controlsDesc1}</li>
                <li>{t.manual.controlsDesc2}</li>
                <li>{t.manual.controlsDesc3}</li>
                <li>{t.manual.controlsDesc4}</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t.manual.modesTitle}</h3>
            <div className="space-y-4">
                <div>
                    <h4 className="font-bold mb-1">{t.manual.editModeTitle}</h4>
                    <p className="whitespace-pre-wrap ml-2">{t.manual.editModeDesc}</p>
                </div>
                <div>
                    <h4 className="font-bold mb-1">{t.manual.playModeTitle}</h4>
                    <p className="whitespace-pre-wrap ml-2">{t.manual.playModeDesc}</p>
                </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t.manual.variablesTitle}</h3>
            <p className="whitespace-pre-wrap">{t.manual.variablesDesc}</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t.manual.shortcutsTitle}</h3>
            <p className="whitespace-pre-wrap">{t.manual.shortcutsDesc}</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary">{t.manual.tipsTitle}</h3>
            <p className="whitespace-pre-wrap">{t.manual.tipsDesc}</p>
          </section>

        </div>
        <div className="p-4 border-t flex justify-end border-border">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded transition-colors bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
