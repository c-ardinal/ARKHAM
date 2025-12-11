
import React from 'react';

export interface MenuActionParams {
    // Defines any specific parameters actions might need, currently mostly void
}

export type MenuItemType = 'item' | 'submenu' | 'divider' | 'custom' | 'checkbox';

export interface MenuItem {
    id: string;
    label?: string; // Divider might not have label
    type: MenuItemType;
    icon?: React.ElementType; // LucideIcon or similar
    action?: () => void;
    children?: MenuItem[]; 
    checked?: boolean; // For checkbox type
    danger?: boolean; // For delete/reset
    customRender?: React.ReactNode; // For custom type
    disabled?: boolean;
}

export interface MenuSection {
    id: string;
    label: string;
    icon?: React.ElementType;
    items: MenuItem[];
}
