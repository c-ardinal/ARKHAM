
import { Package, BookOpen, Zap, Activity, Shield, User, Users, Ghost, HelpCircle, MapPin, Landmark, Scroll } from 'lucide-react';
import type { ResourceType, CharacterType, StageType } from '../types';

export const getIconForResourceType = (type: ResourceType | string, size: number = 16) => {
  // Normalize type to handle potential case differences or legacy data
  // Although types.ts defines specific union types, data might come from various sources
  const normalizedType = type; 

  switch (normalizedType) {
    case 'Knowledge':
    case 'knowledge': // Legacy support if needed
      return <BookOpen size={size} />;
    case 'Item':
    case 'item':
      return <Package size={size} />;
    case 'Equipment':
    case 'equipment':
      return <Shield size={size} />;
    case 'Skill':
    case 'skill':
      return <Zap size={size} />;
    case 'Status':
    case 'stat': // Legacy support
      return <Activity size={size} />;
    case 'Location':
    case 'location':
      return <MapPin size={size} />;
    default:
      return <Package size={size} />;
  }
};

export const getIconForStageType = (type: StageType | string, size: number = 16) => {
  switch (type) {
    case 'Location':
    case 'location':
      return <MapPin size={size} />;
    case 'Faction':
    case 'faction':
      return <Landmark size={size} />;
    case 'Lore':
    case 'lore':
      return <Scroll size={size} />;
    default:
      return <MapPin size={size} />;
  }
};

export const getIconForCharacterType = (type: CharacterType | string, size: number = 16) => {
    switch (type) {
        case 'Person':
            return <User size={size} />;
        case 'Participant':
            return <Users size={size} />;
        case 'Monster':
            return <Ghost size={size} />;
        case 'Other':
            return <HelpCircle size={size} />;
        default:
            return <User size={size} />;
    }
};

