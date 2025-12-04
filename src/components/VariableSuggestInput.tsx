import React, { useState, useRef, useEffect } from 'react';
import { useScenarioStore } from '../store/scenarioStore';

interface VariableSuggestInputProps {
    value: string;
    onChange: (value: string) => void;
    multiline?: boolean;
    className?: string;
    placeholder?: string;
    onBlur?: () => void;
    onFocus?: () => void;
}

export const VariableSuggestInput = ({ 
    value, 
    onChange, 
    multiline = false, 
    className = '', 
    placeholder,
    onBlur,
    onFocus
}: VariableSuggestInputProps) => {
    const { gameState } = useScenarioStore();
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [cursorPos, setCursorPos] = useState(0);
    
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const updateSuggestions = (text: string, cursor: number) => {
        const textBeforeCursor = text.slice(0, cursor);
        const lastOpenIndex = textBeforeCursor.lastIndexOf('${');
        
        if (lastOpenIndex !== -1) {
            const textAfterOpen = textBeforeCursor.slice(lastOpenIndex + 2);
            if (!textAfterOpen.includes('}')) {
                const query = textAfterOpen;
                const variables = Object.keys(gameState.variables);
                const matches = variables.filter(v => v.toLowerCase().includes(query.toLowerCase()));
                
                if (matches.length > 0) {
                    setSuggestions(matches);
                    setShowSuggestions(true);
                    setSelectedIndex(0);
                    return;
                }
            }
        }
        setShowSuggestions(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const newCursorPos = e.target.selectionStart || 0;
        
        onChange(newValue);
        setCursorPos(newCursorPos);
        updateSuggestions(newValue, newCursorPos);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            applySuggestion(suggestions[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const applySuggestion = (variableName: string) => {
        const textBeforeCursor = value.slice(0, cursorPos);
        const lastOpenIndex = textBeforeCursor.lastIndexOf('${');
        
        if (lastOpenIndex !== -1) {
            const suffix = value.slice(cursorPos);
            
            const newValue = `${value.slice(0, lastOpenIndex)}\${${variableName}}${suffix}`;
            onChange(newValue);
            setShowSuggestions(false);
            
            setTimeout(() => {
                if (inputRef.current) {
                    const newPos = lastOpenIndex + 2 + variableName.length + 1;
                    inputRef.current.setSelectionRange(newPos, newPos);
                    inputRef.current.focus();
                }
            }, 0);
        }
    };

    const InputComponent = multiline ? 'textarea' : 'input';

    return (
        <div className="relative w-full" ref={containerRef}>
            <InputComponent
                ref={inputRef as any}
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={onBlur}
                onFocus={onFocus}
                className={className}
                placeholder={placeholder}
                {...(!multiline ? { type: 'text' } : {})}
            />
            {showSuggestions && (
                <ul className="absolute z-50 left-0 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                        <li
                            key={suggestion}
                            onClick={() => applySuggestion(suggestion)}
                            className={`px-3 py-2 cursor-pointer text-sm ${
                                index === selectedIndex 
                                    ? 'bg-accent text-accent-foreground' 
                                    : 'text-popover-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                        >
                            {suggestion}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
