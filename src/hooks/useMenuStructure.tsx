

import { useTranslation } from '../hooks/useTranslation';
import { useScenarioStore } from '../store/scenarioStore';
import { 
    FileText, Save, Upload, Book, Folder, Download, Trash2, 
    Edit, StickyNote, Eye, EyeOff, Sun, Moon, 
    Eye as ViewIcon, Settings, HelpCircle, History, Info, 
    Languages, Activity,
    Maximize, Spline, Minus, CornerDownRight, Route
} from 'lucide-react';
import type { MenuSection } from '../types/menu';
import { ZoomControls } from '../components/common/ZoomControls';

// Define the actions required by the hook that are local to the Layout/Component
export interface MenuExternalActions {
    onSave: () => void;
    onLoadClick: () => void;
    onLoadSample: (type: 'story' | 'nested') => void;
    onExport: (type: 'text' | 'markdown') => void;
    onReset: () => void;
    onOpenManual: () => void;
    onOpenUpdateHistory: () => void;
    onOpenAbout: () => void;
    // View actions
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;
    onSetZoom: (zoom: number) => void;
    currentZoom: number;
}

export const useMenuStructure = (actions: MenuExternalActions): MenuSection[] => {
    const { t } = useTranslation();
    const { 
        edgeType, setEdgeType, 
        theme, setTheme, 
        language, setLanguage,
        showAllStickies, hideAllStickies, deleteAllStickiesGlobal,
        showAllFreeStickies, hideAllFreeStickies, deleteAllFreeStickies,
        showAllNodeStickies, hideAllNodeStickies, deleteAllNodeStickies,
        revealAll, unrevealAll
    } = useScenarioStore();

    // Confirmation wrapper helpers could be handled here or in the caller actions.
    // For now, we assume critical actions like Reset/Delete are handled by the caller passed in 'actions' 
    // OR we wrap them here if we want standard confirm modals. 
    // However, the ConfirmationModal state is usually local to the Layout.
    // Ideally, the 'actions' passed in should already trigger the modal.
    // So 'onReset' passed here should be "show reset confirmation".

    const menuStructure: MenuSection[] = [
        {
            id: 'file',
            label: t('menu.file'),
            icon: FileText,
            items: [
                { id: 'save', type: 'item', label: t('common.save'), icon: Save, action: actions.onSave },
                { id: 'load', type: 'item', label: t('common.load'), icon: Upload, action: actions.onLoadClick },
                { 
                    id: 'load_sample', 
                    type: 'submenu', 
                    label: t('menu.loadSample'), 
                    icon: Book,
                    children: [
                        { id: 'sample_story', type: 'item', label: t('menu.loadStory'), icon: Book, action: () => actions.onLoadSample('story') },
                        { id: 'sample_nested', type: 'item', label: t('menu.loadNestedGroup'), icon: Folder, action: () => actions.onLoadSample('nested') }
                    ]
                },
                { id: 'sep1', type: 'divider' },
                {
                    id: 'export',
                    type: 'submenu',
                    label: t('menu.export'),
                    icon: Download,
                    children: [
                        { id: 'export_txt', type: 'item', label: t('menu.exportSimple'), icon: Download, action: () => actions.onExport('text') },
                        { id: 'export_md', type: 'item', label: t('menu.exportMarkdown'), icon: Download, action: () => actions.onExport('markdown') }
                    ]
                },
                { id: 'sep2', type: 'divider' },
                { id: 'reset', type: 'item', label: t('common.reset'), icon: Trash2, action: actions.onReset, danger: true }
            ]
        },
        {
            id: 'edit',
            label: t('menu.edit'),
            icon: Edit,
            items: [
                {
                    id: 'stickies',
                    type: 'submenu',
                    label: t('menu.stickyNotes'),
                    icon: StickyNote,
                    children: [
                        { id: 'show_all_stickies', type: 'item', label: t('menu.showAllStickies'), icon: Eye, action: showAllStickies },
                        { id: 'hide_all_stickies', type: 'item', label: t('menu.hideAllStickies'), icon: EyeOff, action: hideAllStickies },
                        { id: 'delete_all_stickies', type: 'item', label: t('menu.deleteAllStickies'), icon: Trash2, action: deleteAllStickiesGlobal, danger: true },
                        { id: 'sep_sticky_1', type: 'divider' },
                        { id: 'show_free_stickies', type: 'item', label: t('menu.showFreeStickies'), icon: Eye, action: showAllFreeStickies },
                        { id: 'hide_free_stickies', type: 'item', label: t('menu.hideFreeStickies'), icon: EyeOff, action: hideAllFreeStickies },
                        { id: 'delete_free_stickies', type: 'item', label: t('menu.deleteFreeStickies'), icon: Trash2, action: deleteAllFreeStickies, danger: true },
                        { id: 'sep_sticky_2', type: 'divider' },
                        { id: 'show_node_stickies', type: 'item', label: t('menu.showNodeStickies'), icon: Eye, action: showAllNodeStickies },
                        { id: 'hide_node_stickies', type: 'item', label: t('menu.hideNodeStickies'), icon: EyeOff, action: hideAllNodeStickies },
                        { id: 'delete_node_stickies', type: 'item', label: t('menu.deleteNodeStickies'), icon: Trash2, action: deleteAllNodeStickies, danger: true },
                    ]
                },
                {
                    id: 'bulk_reveal',
                    type: 'submenu',
                    label: t('menu.bulkRevealOperations'),
                    icon: Sun, // or specific icon
                    children: [
                        { id: 'reveal_all', type: 'item', label: t('common.revealAll'), icon: Sun, action: revealAll },
                        { id: 'unreveal_all', type: 'item', label: t('common.unrevealAll'), icon: Moon, action: unrevealAll },
                    ]
                }
            ]
        },
        {
            id: 'view',
            label: t('menu.view'),
            icon: ViewIcon,
            items: [
                { id: 'zoom_label', type: 'item', label: t('menu.zoomLevel'), disabled: true }, // As a label/header
                { 
                    id: 'zoom_controls', 
                    type: 'custom', 
                    customRender: (
                        <ZoomControls 
                            currentZoom={actions.currentZoom} 
                            onZoomIn={actions.onZoomIn} 
                            onZoomOut={actions.onZoomOut} 
                            onSetZoom={actions.onSetZoom}
                            onFitView={actions.onFitView}
                            showFitView={false} // We add FitView separately to match structure or keep it inside? User's original had separate fitview item in menu lists, so keeping separate for consistency.
                        />
                    )
                },
                { id: 'sep_view', type: 'divider' },
                { id: 'fit_view', type: 'item', label: t('menu.fitView'), icon: Maximize, action: actions.onFitView }
            ]
        },
        {
            id: 'setting',
            label: t('menu.setting'),
            icon: Settings,
            items: [
                { 
                    id: 'theme', 
                    type: 'item', 
                    label: theme === 'dark' ? t('menu.switchToLight') : t('menu.switchToDark'), 
                    icon: theme === 'dark' ? Sun : Moon, 
                    action: () => setTheme(theme === 'dark' ? 'light' : 'dark') 
                },
                {
                    id: 'lang',
                    type: 'item',
                    label: language === 'en' ? t('menu.switchToJa') : t('menu.switchToEn'),
                    icon: Languages,
                    action: () => setLanguage(language === 'en' ? 'ja' : 'en')
                },
                {
                    id: 'edge_style',
                    type: 'submenu',
                    label: t('menu.changeEdgeStyle'),
                    icon: Activity,
                    children: [
                        { id: 'edge_default', type: 'checkbox', label: t('menu.edgeStyle.default'), icon: Spline, checked: edgeType === 'default', action: () => setEdgeType('default') },
                        { id: 'edge_straight', type: 'checkbox', label: t('menu.edgeStyle.straight'), icon: Minus, checked: edgeType === 'straight', action: () => setEdgeType('straight') },
                        { id: 'edge_step', type: 'checkbox', label: t('menu.edgeStyle.step'), icon: CornerDownRight, checked: edgeType === 'step', action: () => setEdgeType('step') },
                        { id: 'edge_smoothstep', type: 'checkbox', label: t('menu.edgeStyle.smoothstep'), icon: Route, checked: edgeType === 'smoothstep', action: () => setEdgeType('smoothstep') },
                    ]
                }
            ]
        },
        {
            id: 'help',
            label: t('menu.help'),
            icon: HelpCircle,
            items: [
                { id: 'manual', type: 'item', label: t('common.manual'), icon: Book, action: actions.onOpenManual },
                { id: 'history', type: 'item', label: t('menu.updateHistory'), icon: History, action: actions.onOpenUpdateHistory },
                { id: 'about', type: 'item', label: t('menu.about'), icon: Info, action: actions.onOpenAbout },
            ]
        }
    ];

    return menuStructure;
};
