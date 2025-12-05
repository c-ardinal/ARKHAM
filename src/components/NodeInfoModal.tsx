import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { X, User, Users, Ghost, HelpCircle, Package, Shield, Book, Zap, Activity } from 'lucide-react';

interface NodeInfoModalProps {
  referenceId: string | null;
  onClose: () => void;
}

export const NodeInfoModal = ({ referenceId, onClose }: NodeInfoModalProps) => {
  const { characters, resources } = useScenarioStore();
  const { t } = useTranslation();

  if (!referenceId) return null;

  const character = characters.find(c => c.id === referenceId);
  const resource = resources.find(r => r.id === referenceId);

  const data = character || resource;
  if (!data) return null;

  const getIcon = () => {
      if (character) {
        switch (character.type) {
            case 'Person': return <User size={24} />;
            case 'Participant': return <Users size={24} />;
            case 'Monster': return <Ghost size={24} />;
            case 'Other': return <HelpCircle size={24} />;
            default: return <User size={24} />;
        }
      } else if (resource) {
        switch (resource.type) {
            case 'Item': return <Package size={24} />;
            case 'Equipment': return <Shield size={24} />;
            case 'Knowledge': return <Book size={24} />;
            case 'Skill': return <Zap size={24} />;
            case 'Status': return <Activity size={24} />;
            default: return <Package size={24} />;
        }
      }
      return null;
  };

  const getTypeLabel = () => {
       if (character) {
           const types = (t.characters?.types as any) || {};
           return types[character.type] || character.type;
       }
       if (resource) {
           const types = (t.resources?.types as any) || {};
           return types[resource.type] || resource.type;
       }
       return '';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xl shadow-black/20 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex justify-between items-start bg-muted/30">
            <div className="flex gap-4">
                <div className="p-3 bg-primary/10 rounded-full text-primary h-fit">
                    {getIcon()}
                </div>
                <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                        {getTypeLabel()}
                    </div>
                    {data.reading && (
                        <div className="text-xs text-muted-foreground leading-none mb-0.5">
                            {data.reading}
                        </div>
                    )}
                    <div className="text-2xl font-bold leading-none mb-1">
                        {data.name}
                    </div>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            >
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
            {data.description && (
                <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">{t.properties?.description || 'Description'}</h4>
                    <div className="whitespace-pre-wrap leading-relaxed">
                        {data.description}
                    </div>
                </div>
            )}

            {character && (
                <>
                    {character.abilities && (
                        <div>
                             <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">{t.characters?.abilities || 'Abilities'}</h4>
                             <div className="whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded">
                                {character.abilities}
                             </div>
                        </div>
                    )}
                    {character.skills && (
                        <div>
                             <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">{t.characters?.skills || 'Skills'}</h4>
                             <div className="whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded">
                                {character.skills}
                             </div>
                        </div>
                    )}
                </>
            )}

            {resource && (
                <>
                    {resource.effect && (
                        <div>
                             <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">{t.resources?.effect || 'Effect'}</h4>
                             <div className="whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded">
                                {resource.effect}
                             </div>
                        </div>
                    )}
                     {resource.cost && (
                        <div>
                             <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">{t.resources?.cost || 'Cost'}</h4>
                             <div className="text-sm font-medium">
                                {resource.cost}
                             </div>
                        </div>
                    )}
                </>
            )}

             {data.note && (
                <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">
                        {character ? (t.characters?.note || 'Note') : (t.resources?.note || 'Note')}
                    </h4>
                    <div className="whitespace-pre-wrap text-sm text-muted-foreground italic">
                        {data.note}
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 text-right">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-medium"
            >
                {t.common?.close || 'Close'}
            </button>
        </div>

      </div>
    </div>
  );
};
