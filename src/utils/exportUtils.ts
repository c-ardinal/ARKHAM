import type { Node, Edge } from 'reactflow';
import type { ScenarioNodeData } from '../types';
import { substituteVariables } from './textUtils';
import type { Variable } from '../types';

type ExportFormat = 'text' | 'markdown';

export const generateScenarioText = (
    nodes: Node<ScenarioNodeData>[],
    edges: Edge[],
    variables: Record<string, Variable>,
    format: ExportFormat
): string => {
    const lines: string[] = [];
    
    // 1. Analyze Graph to find Merge Nodes (indegree > 1)
    const incomingCounts = new Map<string, number>();
    nodes.forEach(n => incomingCounts.set(n.id, 0));
    edges.forEach(e => {
        const count = incomingCounts.get(e.target) || 0;
        incomingCounts.set(e.target, count + 1);
    });

    const isMergeNode = (id: string) => (incomingCounts.get(id) || 0) > 1;

    const visitedNodes = new Set<string>();
    const visitedSections = new Set<string>();
    const sectionQueue: string[] = [];

    // Helper to format text based on variables
    const process = (text: string) => substituteVariables(text || '', variables);

    // Helper to add a line
    const addLine = (text: string) => lines.push(text);
    const addSection = (title: string, content?: string) => {
        if (format === 'markdown') {
            addLine(`## ${title}`);
            if (content) addLine(content + '\n');
        } else {
            addLine(`[${title}]`);
            if (content) addLine(content + '\n');
        }
    };

    // Helper to format node content
    const formatNode = (node: Node<ScenarioNodeData>) => {
        const label = process(node.data.label);
        const desc = process(node.data.description || '');
        
        if (format === 'markdown') {
            addLine(`### ${label} (${node.type})`);
            if (desc) addLine(desc);
            
            if (node.type === 'element' || node.type === 'information') {
                addLine(`- **Type:** ${node.data.infoType}`);
                addLine(`- **Value:** ${process(node.data.infoValue || '')}`);
                if (node.data.quantity !== undefined) {
                    const qty = node.data.actionType === 'consume' ? -1 * node.data.quantity : node.data.quantity;
                    addLine(`- **Quantity:** ${qty}`);
                }
            } else if (node.type === 'branch') {
                addLine(`- **Type:** ${node.data.branchType}`);
                if (node.data.branchType === 'switch') {
                    addLine(`- **Target:** ${node.data.conditionValue || node.data.conditionVariable}`);
                } else {
                    addLine(`- **Condition:** ${process(node.data.conditionValue || '')}`);
                }
            } else if (node.type === 'variable') {
                addLine(`- **Set:** ${node.data.targetVariable} = ${process(node.data.variableValue || '')}`);
            }
            addLine('');
        } else {
            addLine(`----------------------------------------`);
            addLine(`Node: ${label} [${node.type}]`);
            if (desc) addLine(`Description: ${desc}`);
            
            if (node.type === 'element' || node.type === 'information') {
                addLine(`Type: ${node.data.infoType}`);
                addLine(`Value: ${process(node.data.infoValue || '')}`);
                if (node.data.quantity !== undefined) {
                    const qty = node.data.actionType === 'consume' ? -1 * node.data.quantity : node.data.quantity;
                    addLine(`Quantity: ${qty}`);
                }
            } else if (node.type === 'branch') {
                addLine(`Branch Type: ${node.data.branchType}`);
                if (node.data.branchType === 'switch') {
                    addLine(`Target: ${node.data.conditionValue || node.data.conditionVariable}`);
                } else {
                    addLine(`Condition: ${process(node.data.conditionValue || '')}`);
                }
            } else if (node.type === 'variable') {
                addLine(`Set Variable: ${node.data.targetVariable} = ${process(node.data.variableValue || '')}`);
            }
            addLine('');
        }
    };

    // Recursive traversal function
    const processChain = (nodeId: string, depth: number) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        visitedNodes.add(nodeId);
        
        formatNode(node);

        const outgoing = edges.filter(e => e.source === nodeId);
        
        if (outgoing.length === 0) {
            if (format === 'markdown') addLine(`> *(End of path)*\n`);
            else addLine(`(End of path)\n`);
        } else if (outgoing.length === 1) {
            const targetId = outgoing[0].target;
            const targetNode = nodes.find(n => n.id === targetId);
            const label = targetNode ? process(targetNode.data.label) : 'Unknown';

            if (isMergeNode(targetId)) {
                // Stop at merge node and queue it
                if (format === 'markdown') addLine(`> **Jump to:** ${label}\n`);
                else addLine(`-> Jump to: ${label}\n`);
                
                if (!visitedSections.has(targetId) && !sectionQueue.includes(targetId)) {
                    sectionQueue.push(targetId);
                }
            } else {
                // Check for loops (visited in current chain or globally if not merge node)
                // Since we stop at merge nodes, any re-visit of a non-merge node implies a loop within the branch
                if (visitedNodes.has(targetId)) {
                     if (format === 'markdown') addLine(`> **Jump to:** ${label} (Loop)\n`);
                     else addLine(`-> Jump to: ${label} (Loop)\n`);
                } else {
                    processChain(targetId, depth);
                }
            }
        } else {
            // Branching
            // 1. List all options summary
            outgoing.forEach((edge, index) => {
                const targetNode = nodes.find(n => n.id === edge.target);
                const targetLabel = targetNode ? process(targetNode.data.label) : 'Unknown';
                
                let caseLabel = `Option ${index + 1}`;
                if (node.type === 'branch') {
                    if (node.data.branchType === 'switch' && node.data.branches) {
                        const branch = node.data.branches.find(b => b.id === edge.sourceHandle);
                        if (branch) caseLabel = process(branch.label);
                    } else if (node.data.branchType === 'if_else') {
                        if (edge.sourceHandle === 'true') caseLabel = 'True';
                        else if (edge.sourceHandle === 'false') caseLabel = 'False';
                    }
                }

                if (format === 'markdown') {
                    addLine(`- **${caseLabel}** -> ${targetLabel}`);
                } else {
                    addLine(`[${caseLabel}] -> ${targetLabel}`);
                }
            });
            addLine('');

            // 2. Traverse each branch
            outgoing.forEach((edge, index) => {
                const targetId = edge.target;
                const targetNode = nodes.find(n => n.id === targetId);
                const targetLabel = targetNode ? process(targetNode.data.label) : 'Unknown';
                
                let caseLabel = `Option ${index + 1}`;
                if (node.type === 'branch') {
                    if (node.data.branchType === 'switch' && node.data.branches) {
                        const branch = node.data.branches.find(b => b.id === edge.sourceHandle);
                        if (branch) caseLabel = process(branch.label);
                    } else if (node.data.branchType === 'if_else') {
                        if (edge.sourceHandle === 'true') caseLabel = 'True';
                        else if (edge.sourceHandle === 'false') caseLabel = 'False';
                    }
                }

                if (format === 'markdown') {
                    addLine(`#### Path: ${caseLabel} (-> ${targetLabel})`);
                } else {
                    addLine(`--- Path: ${caseLabel} (-> ${targetLabel}) ---`);
                }

                if (isMergeNode(targetId)) {
                    if (format === 'markdown') addLine(`> **Jump to:** ${targetLabel}\n`);
                    else addLine(`-> Jump to: ${targetLabel}\n`);
                    
                    if (!visitedSections.has(targetId) && !sectionQueue.includes(targetId)) {
                        sectionQueue.push(targetId);
                    }
                } else {
                    if (visitedNodes.has(targetId)) {
                        if (format === 'markdown') addLine(`> **Jump to:** ${targetLabel} (Loop)\n`);
                        else addLine(`-> Jump to: ${targetLabel} (Loop)\n`);
                    } else {
                        processChain(targetId, depth + 1);
                    }
                }
            });
        }
    };

    // Header
    if (format === 'markdown') {
        addLine(`# Scenario Export`);
        addLine(`*Generated by ARKHAM*`);
        addLine('');
    } else {
        addLine(`SCENARIO EXPORT`);
        addLine(`Generated by ARKHAM`);
        addLine(`========================================`);
        addLine('');
    }

    // 2. Find Start Nodes
    const startNodes = nodes.filter(n => 
        (n.type === 'event' && n.data.isStart) || 
        (incomingCounts.get(n.id) === 0 && n.type !== 'group')
    );
    
    // Sort start nodes
    startNodes.sort((a, b) => {
        if (a.data.isStart && !b.data.isStart) return -1;
        if (!a.data.isStart && b.data.isStart) return 1;
        return a.position.y - b.position.y;
    });

    startNodes.forEach(n => {
        if (!sectionQueue.includes(n.id)) {
            sectionQueue.push(n.id);
        }
    });

    // 3. Process Queue
    while (sectionQueue.length > 0) {
        const nodeId = sectionQueue.shift()!;
        if (visitedSections.has(nodeId)) continue;
        visitedSections.add(nodeId);
        
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            addSection(`Flow Starting at: ${process(node.data.label)}`);
            processChain(nodeId, 0);
            addLine('\n' + (format === 'markdown' ? '---' : '========================================') + '\n');
        }
    }

    // 4. Disconnected / Remarks
    const unvisitedNodes = nodes.filter(n => !visitedNodes.has(n.id) && n.type !== 'group');
    
    if (unvisitedNodes.length > 0) {
        addSection(format === 'markdown' ? 'Disconnected Nodes / Remarks' : 'DISCONNECTED NODES / REMARKS');
        unvisitedNodes.sort((a, b) => a.position.y - b.position.y).forEach(node => {
            formatNode(node);
        });
    }

    return lines.join('\n');
};
