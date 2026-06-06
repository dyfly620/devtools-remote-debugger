import { IGNORE_NODE } from './constant';
import { isElement } from './utils';

interface PseudoElementInfo {
  pseudoType: string;
  nodeId: number;
  nodeName: string;
  nodeType: number;
  nodeValue: string | null;
  backendNodeId: number;
  childNodeCount: number;
  attributes: string[];
}

interface NodeInfo {
  nodeId: number;
  nodeType: number;
  nodeName: string;
  localName: string;
  nodeValue: string | null;
  backendNodeId: number;
  childNodeCount: number;
  attributes?: string[];
  parentId?: number;
  children?: NodeInfo[];
  pseudoElements?: PseudoElementInfo[];
}

class Nodes {
  // DOM node id collection
  nodeIds = new Map<Node, number>();

  // DOM node collection
  nodes = new Map<number, Node>();

  hasRequestedChildNode = new Set<number>();

  currentId = 0;

  /**
   * Is it a node
   */
  isNode(node: Node | null): boolean {
    if (!node) return false;
    // Ignore DOM nodes for debugging
    if ((node as Element).getAttribute && IGNORE_NODE.includes((node as Element).getAttribute('class') || '')) return false;
    // non-text node
    if (node.nodeType !== Node.TEXT_NODE) return true;
    // non-empty text node
    if (node.nodeType === Node.TEXT_NODE && (node.nodeValue || '').trim() !== '') return true;
    return false;
  }

  create(nodeId: number, node: Node): void {
    this.nodeIds.set(node, nodeId);
    this.nodes.set(nodeId, node);
  }

  init(): void {
    this.nodeIds.clear();
    this.nodes.clear();
    this.hasRequestedChildNode.clear();
  }

  hasNode(node: Node): boolean {
    return this.nodeIds.has(node);
  }

  getNodeById(nodeId: number): Node | undefined {
    return this.nodes.get(nodeId);
  }

  getIdByNode(node: Node): number {
    let nodeId = this.nodeIds.get(node);
    if (nodeId) return nodeId;

    nodeId = this.currentId++;
    this.create(nodeId, node);

    return nodeId;
  }

  /**
   * Collect child nodes
   */
  collectNodes(node: Node, depth = 2): NodeInfo {
    const nodeId = this.getIdByNode(node);
    const { nodeType, nodeName, nodeValue, parentNode, childNodes } = node;
    const localName = (node as Element).localName || node.nodeName;
    const res: NodeInfo = {
      nodeId,
      nodeType,
      nodeName,
      localName,
      nodeValue,
      backendNodeId: nodeId,
      childNodeCount: childNodes.length
    };

    if ((node as Element).attributes) {
      const attributes = (node as Element).attributes;
      res.attributes = Array.from(attributes).reduce<string[]>((pre, curr) => pre.concat(curr.name, curr.value), []);
    }

    if (parentNode) {
      res.parentId = this.getIdByNode(parentNode);
    }

    if (depth > 0) {
      res.children = this.getChildNodes(node, depth);
    }

    if (isElement(node)) {
      const element = node as Element;
      const beforeContent = window.getComputedStyle(element, '::before').content;
      const afterContent = window.getComputedStyle(element, '::after').content;
      const pseudoTypes: string[] = [];
      if (beforeContent !== 'none') {
        pseudoTypes.push('before');
      }
      if (afterContent !== 'none') {
        pseudoTypes.push('after');
      }
      if (pseudoTypes.length) {
        res.pseudoElements = pseudoTypes.map((pseudoType) => {
          const pseudoNodeName = `::${pseudoType}`;
          const pseudoNodeId = this.getIdByNode({
            nodeName: pseudoNodeName,
            parentNode: node,
          } as any);
          return {
            pseudoType,
            nodeId: pseudoNodeId,
            nodeName: pseudoNodeName,
            nodeType,
            nodeValue,
            backendNodeId: pseudoNodeId,
            childNodeCount: 0,
            attributes: [],
          };
        });
      }
    }

    return res;
  }

  /**
   * Collect DOM child elements
   */
  getChildNodes(node: Node, depth = 1): NodeInfo[] {
    return Array.from(node.childNodes)
      .filter(child => this.isNode(child))
      .map(childNode => this.collectNodes(childNode, depth - 1));
  }

  /**
   * Get the former sibling node of DOM
   */
  getPreviousNode(node: Node): Node | undefined {
    let previousNode = node.previousSibling;
    if (!previousNode) return;

    while (!this.isNode(previousNode) && previousNode!.previousSibling) {
      previousNode = previousNode!.previousSibling;
    }

    return previousNode || undefined;
  }
}

export default new Nodes();
