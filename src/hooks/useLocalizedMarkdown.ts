import { useState, useEffect } from 'react';
import { useTranslation } from './useTranslation';

interface LocalizedContent {
    ja: string;
    en: string;
}

// Global cache to persist across re-renders and unmounts
const cache: Record<string, LocalizedContent | Promise<LocalizedContent>> = {};

const parseSections = (text: string): LocalizedContent => {
    const sections = text.split(/<!--\s*SECTION:\s*([a-z]+)\s*-->/);
    const content: LocalizedContent = { ja: '', en: '' };

    for (let i = 1; i < sections.length; i += 2) {
        const langKey = sections[i].trim();
        const sectionContent = sections[i + 1].trim();
        if (langKey === 'ja') content.ja = sectionContent;
        if (langKey === 'en') content.en = sectionContent;
    }

    // Fallback if one is missing
    if (!content.ja) content.ja = content.en;
    if (!content.en) content.en = content.ja;

    return content;
};

export const useLocalizedMarkdown = (url: string) => {
    const { language } = useTranslation();
    const [content, setContent] = useState<string>('');

    useEffect(() => {
        const load = async () => {
             // If already cached and resolved
            if (cache[url] && 'ja' in (cache[url] as any)) {
                // It's a resolved object
                const data = cache[url] as LocalizedContent;
                 // @ts-ignore
                setContent(data[language] || data['en'] || '');
                return;
            }

            // If not cached, or is a promise
            if (!cache[url]) {
                cache[url] = fetch(url)
                    .then(res => res.text())
                    .then(text => parseSections(text))
                    .then(data => {
                        cache[url] = data; // Replace promise with data
                        return data;
                    })
                    .catch(err => {
                        console.error(`Failed to load markdown: ${url}`, err);
                        return { ja: 'Failed to load', en: 'Failed to load' };
                    });
            }

            // Wait for promise
            if (cache[url] instanceof Promise) {
                 const data = await (cache[url] as Promise<LocalizedContent>);
                  // @ts-ignore
                 setContent(data[language] || data['en'] || '');
            } else {
                 const data = cache[url] as LocalizedContent;
                  // @ts-ignore
                 setContent(data[language] || data['en'] || '');
            }
        };

        load();
    }, [url, language]);

    return content;
};
