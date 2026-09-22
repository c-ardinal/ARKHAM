import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_SYSTEM_PRESETS, DEFAULT_SYSTEM_CONFIG } from '../schema';
import { useScenarioStore } from '../../store/scenarioStore';
import { buildCoreGraph } from '../adapter';
import { exportToScenarioMarkdown } from '../exporter';

describe('TRPG System Configuration & Abstraction Tests', () => {
  beforeEach(() => {
    useScenarioStore.getState().resetToInitialState();
  });

  it('provides all standard presets (coc, emoklore, insane, generic, custom)', () => {
    expect(DEFAULT_SYSTEM_CONFIG).toBeDefined();
    expect(DEFAULT_SYSTEM_PRESETS.coc).toBeDefined();
    expect(DEFAULT_SYSTEM_PRESETS.emoklore).toBeDefined();
    expect(DEFAULT_SYSTEM_PRESETS.insane).toBeDefined();
    expect(DEFAULT_SYSTEM_PRESETS.generic).toBeDefined();
    expect(DEFAULT_SYSTEM_PRESETS.custom).toBeDefined();

    expect(DEFAULT_SYSTEM_PRESETS.coc.checkLabel).toBe('正気度(SAN)チェック');
    expect(DEFAULT_SYSTEM_PRESETS.emoklore.checkLabel).toBe('共鳴・精神判定');
    expect(DEFAULT_SYSTEM_PRESETS.insane.checkLabel).toBe('恐怖判定 / 狂気獲得');
    expect(DEFAULT_SYSTEM_PRESETS.generic.checkLabel).toBe('精神・リソース判定 (Resource Check)');
  });

  it('creates new scenario with specific title and system preset', () => {
    const store = useScenarioStore.getState();
    store.createNewScenario('エモクロア新章', DEFAULT_SYSTEM_PRESETS.emoklore);

    const state = useScenarioStore.getState();
    expect(state.scenarioTitle).toBe('エモクロア新章');
    expect(state.systemConfig.id).toBe('emoklore');
    expect(state.systemConfig.checkLabel).toBe('共鳴・精神判定');
    expect(state.tabs.length).toBe(1);
  });

  it('switches system configuration dynamically', () => {
    const store = useScenarioStore.getState();
    store.setSystemConfig(DEFAULT_SYSTEM_PRESETS.insane);

    expect(useScenarioStore.getState().systemConfig.id).toBe('insane');
    expect(useScenarioStore.getState().systemConfig.resourceName).toBe('正気度 / 生命力');
  });

  it('infers CoC system for legacy scenarios with sanCheck and generic for others', () => {
    const store = useScenarioStore.getState();

    // Legacy scenario with sanCheck
    store.loadScenario({
      tabs: [{
        id: 'tab1',
        name: 'メイン',
        nodes: [{
          id: 'n1',
          type: 'event',
          position: { x: 0, y: 0 },
          data: { label: '怪異遭遇', sanCheck: { trigger: '目撃', successLoss: '0', failLoss: '1D6' } }
        }],
        edges: []
      }]
    } as any);

    expect(useScenarioStore.getState().systemConfig.id).toBe('coc');

    // Scenario without sanCheck
    store.loadScenario({
      tabs: [{
        id: 'tab2',
        name: 'メイン',
        nodes: [{
          id: 'n2',
          type: 'event',
          position: { x: 0, y: 0 },
          data: { label: '通常探索' }
        }],
        edges: []
      }]
    } as any);

    expect(useScenarioStore.getState().systemConfig.id).toBe('generic');
  });

  it('exports markdown with system-specific check label', () => {
    const coreGraph = buildCoreGraph(
      [{
        id: 'n1',
        type: 'event',
        position: { x: 0, y: 0 },
        data: {
          label: '共鳴の場',
          chapter: 1,
          locationId: 'loc_resonance',
          resourceCheck: { trigger: '共鳴波動', successLoss: '1', failLoss: '1D4' }
        }
      }],
      [],
      [{ id: 'loc_resonance', name: '共鳴の間', type: 'Location' }],
      DEFAULT_SYSTEM_PRESETS.emoklore
    );

    const md = exportToScenarioMarkdown(coreGraph);
    expect(md).toContain('- **共鳴・精神判定**: 共鳴波動 (成功: 1 / 失敗: 1D4)');
  });
});
