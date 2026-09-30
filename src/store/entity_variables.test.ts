import { describe, it, expect, beforeEach } from 'vitest';
import { useScenarioStore } from './scenarioStore';
import { substituteVariables } from '../utils/textUtils';

describe('Entity Variables & Constants System', () => {
  beforeEach(() => {
    useScenarioStore.getState().resetToInitialState();
  });

  it('allows adding, updating, and deleting variables and constants on Characters', () => {
    const store = useScenarioStore.getState();
    store.addCharacter({ name: '探索者A', type: 'Protagonist' });
    const char = useScenarioStore.getState().characters[0];
    expect(char).toBeDefined();

    // Add variable
    useScenarioStore.getState().addEntityVariable('character', char.id, {
      name: 'HP',
      type: 'number',
      value: 12,
      isConstant: false,
    });

    // Add constant
    useScenarioStore.getState().addEntityVariable('character', char.id, {
      name: 'MaxHP',
      type: 'number',
      value: 12,
      isConstant: true,
    });

    let updatedChar = useScenarioStore.getState().characters.find((c) => c.id === char.id)!;
    expect(updatedChar.variables).toHaveLength(2);
    expect(updatedChar.variables![0].name).toBe('HP');
    expect(updatedChar.variables![0].isConstant).toBe(false);
    expect(updatedChar.variables![1].name).toBe('MaxHP');
    expect(updatedChar.variables![1].isConstant).toBe(true);

    // Delta update on variable
    useScenarioStore.getState().updateEntityVariableValue('character', char.id, updatedChar.variables![0].id, -3, true);
    updatedChar = useScenarioStore.getState().characters.find((c) => c.id === char.id)!;
    expect(updatedChar.variables![0].value).toBe(9);

    // Delete variable
    useScenarioStore.getState().deleteEntityVariable('character', char.id, updatedChar.variables![1].id);
    updatedChar = useScenarioStore.getState().characters.find((c) => c.id === char.id)!;
    expect(updatedChar.variables).toHaveLength(1);
  });

  it('correctly aggregates dot notation variables in getAllVariables and supports substituteVariables', () => {
    const store = useScenarioStore.getState();
    store.addCharacter({ name: 'アリス', type: 'NPC' });
    const char = useScenarioStore.getState().characters[0];

    useScenarioStore.getState().addEntityVariable('character', char.id, {
      name: 'SAN',
      type: 'number',
      value: 65,
      isConstant: false,
    });

    store.addStage({ name: '図書室', type: 'Location' });
    const stage = useScenarioStore.getState().stages[0];

    useScenarioStore.getState().addEntityVariable('stage', stage.id, {
      name: '調査度',
      type: 'number',
      value: 3,
      isConstant: false,
    });

    const allVars = useScenarioStore.getState().getAllVariables();
    expect(allVars['アリス.SAN']).toBeDefined();
    expect(allVars['アリス.SAN'].value).toBe(65);

    expect(allVars['図書室.調査度']).toBeDefined();
    expect(allVars['図書室.調査度'].value).toBe(3);

    // Test Markdown/Template string substitution with dot notation
    const text = 'アリスのSAN値は${アリス.SAN}で、図書室の調査度は${図書室.調査度}です。';
    const resolved = substituteVariables(text, allVars);
    expect(resolved).toBe('アリスのSAN値は65で、図書室の調査度は3です。');
  });

  it('supports updating entity variables via updateVariable using dot notation', () => {
    const store = useScenarioStore.getState();
    store.addCharacter({ name: 'ボブ', type: 'Protagonist' });
    const char = useScenarioStore.getState().characters[0];

    useScenarioStore.getState().addEntityVariable('character', char.id, {
      name: 'HP',
      type: 'number',
      value: 10,
      isConstant: false,
    });

    // Update via dot notation
    useScenarioStore.getState().updateVariable('ボブ.HP', 5);

    const updatedChar = useScenarioStore.getState().characters.find((c) => c.id === char.id)!;
    expect(updatedChar.variables![0].value).toBe(5);
  });

  it('synchronizes with linked global variable when configured', () => {
    // Add global variable
    useScenarioStore.getState().addVariable('global_alarm', 'number', 100);

    const store = useScenarioStore.getState();
    store.addStage({ name: '研究所', type: 'Location' });
    const stage = useScenarioStore.getState().stages[0];

    useScenarioStore.getState().addEntityVariable('stage', stage.id, {
      name: '警報レベル',
      type: 'number',
      value: 100,
      linkedVariable: 'global_alarm',
    });

    // Updating via updateEntityVariableValue syncs with gameState.variables
    const stageVar = useScenarioStore.getState().stages[0].variables![0];
    useScenarioStore.getState().updateEntityVariableValue('stage', stage.id, stageVar.id, 20, true);

    expect(useScenarioStore.getState().gameState.variables['global_alarm'].value).toBe(120);

    const allVars = useScenarioStore.getState().getAllVariables();
    expect(allVars['研究所.警報レベル'].value).toBe(120);
  });
});
