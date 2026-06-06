import nodes from '../common/nodes';
import { getObjectById } from '../common/remoteObject';
import { DEVTOOL_OVERLAY, IGNORE_NODE } from '../common/constant';
import BaseDomain from './domain';
import { Event } from './protocol';
import Overlay from './overlay';

export default class Dom extends BaseDomain {
  namespace = 'DOM';

  searchId = 0;

  searchRet = new Map<number, Element[]>();

  currentSearchKey = '';

  static set$Function(): void {
    if (typeof window.$ !== 'function') {
      window.$ = function (selector: string) {
        return document.querySelector(selector);
      };
    }

    if (typeof window.$$ !== 'function') {
      window.$$ = function (selector: string) {
        return document.querySelectorAll(selector);
      };
    }

    if (typeof window.$x !== 'function') {
      window.$x = function (selector: string) {
        const xpathResult = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const elements: Element[] = [];

        for (let i = 0; i < xpathResult.snapshotLength; i++) {
          elements.push(xpathResult.snapshotItem(i) as Element);
        }

        return elements;
      };
    }
  }

  enable(): void {
    nodes.init();
    this.nodeObserver();
    this.setDomInspect();
    Dom.set$Function();
  }

  getDocument(): { root: ReturnType<typeof nodes.collectNodes> } {
    return {
      root: nodes.collectNodes(document),
    };
  }

  requestChildNodes({ nodeId }: { nodeId: number }): void {
    if (nodes.hasRequestedChildNode.has(nodeId)) {
      return;
    }
    nodes.hasRequestedChildNode.add(nodeId);
    this.send({
      method: Event.setChildNodes,
      params: {
        parentId: nodeId,
        nodes: nodes.getChildNodes(nodes.getNodeById(nodeId)!, 2)
      }
    });
  }

  getOuterHTML({ nodeId }: { nodeId: number }): { outerHTML: string } {
    return {
      outerHTML: (nodes.getNodeById(nodeId) as Element).outerHTML
    };
  }

  setOuterHTML({ nodeId, outerHTML }: { nodeId: number; outerHTML: string }): void {
    (nodes.getNodeById(nodeId) as Element).outerHTML = outerHTML;
  }

  setAttributesAsText({ nodeId, text }: { nodeId: number; text: string }): void {
    const node = nodes.getNodeById(nodeId) as Element;
    if (text) {
      text.split(' ').filter(item => item)
        .forEach((item) => {
          const [name, value] = item.split('=');
          node.setAttribute(name, value.replace(/["']/g, ''));
        });
    } else {
      Array.from(node.attributes).forEach(attr => node.removeAttribute(attr.name));
    }
  }

  requestNode({ objectId }: { objectId: string }): { nodeId: number } {
    const node = getObjectById(objectId) as Node;
    const nodeId = nodes.getIdByNode(node);
    return { nodeId };
  }

  setInspectedNode({ nodeId }: { nodeId: number }): void {
    window.$0 = nodes.getNodeById(nodeId) as Element;
  }

  removeNode({ nodeId }: { nodeId: number }): void {
    const node = nodes.getNodeById(nodeId) as Element;
    node?.parentNode?.removeChild(node);
  }

  pushNodesByBackendIdsToFrontend({ backendNodeIds }: { backendNodeIds: number[] }): { nodeIds: number[] } {
    return {
      nodeIds: backendNodeIds
    };
  }

  performSearch({ query }: { query: string }): { searchId: number; resultCount: number } {
    let ret = this.searchRet.get(this.searchId);

    if (this.currentSearchKey !== query) {
      this.currentSearchKey = query;
      const allNodes = document.querySelectorAll('*');
      ret = Array.from(allNodes).filter(node => {
        if (!nodes.isNode(node)) return false;

        // element node
        if (node.nodeType === Node.ELEMENT_NODE && node.nodeName.toLowerCase().includes(query)) {
          return true;
        }

        // match attributes
        const el = node as Element;
        for (let i = 0; i < el.attributes.length; i++) {
          const curr = el.attributes[i];
          if (curr.name.includes(query) || curr.value.includes(query)) {
            return true;
          }
        }

        return false;
      });

      this.searchRet.delete(this.searchId);
      this.searchRet.set(++this.searchId, ret);
    }

    return {
      searchId: this.searchId,
      resultCount: ret ? ret.length : 0,
    };
  }

  getSearchResults({ fromIndex, toIndex, searchId }: { fromIndex: number; toIndex: number; searchId: number }): { nodeIds: number[] } {
    const ret = this.searchRet.get(searchId)!.slice(fromIndex, toIndex);
    const nodeIds: number[] = [];
    ret.forEach(node => {
      this.expandNode(node);
      nodeIds.push(nodes.getIdByNode(node));
    });

    return { nodeIds };
  }

  discardSearchResults({ searchId }: { searchId: number }): void {
    this.searchRet.delete(searchId);
  }

  getNodeForLocation({ x, y }: { x: number; y: number }): { frameId: number; backendNodeId: number; nodeId: number } | undefined {
    const hoverNode = document.elementFromPoint(x, y);
    if (hoverNode) {
      this.expandNode(hoverNode);
      const nodeId = nodes.getIdByNode(hoverNode);
      return {
        frameId: 1,
        backendNodeId: nodeId,
        nodeId,
      };
    }
  }

  setNodeValue({ nodeId, value }: { nodeId: number; value: string }): void {
    const node = nodes.getNodeById(nodeId)!;
    node.nodeValue = value;
  }

  getBoxModel({ nodeId }: { nodeId: number }): { model: Record<string, unknown> } {
    const node = nodes.getNodeById(nodeId) as Element;
    const styles = window.getComputedStyle(node);
    const margin = Overlay.getStylePropertyValue(['margin-top', 'margin-right', 'margin-bottom', 'margin-left'], styles) as number[];
    const padding = Overlay.getStylePropertyValue(['padding-top', 'padding-right', 'padding-bottom', 'padding-left'], styles) as number[];
    const border = Overlay.getStylePropertyValue(['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'], styles) as number[];

    const { left, right, top, bottom, width, height } = node.getBoundingClientRect();

    return {
      model: {
        width,
        height,
        content: [
          left + border[3] + padding[3], top + border[0] + padding[0],
          right - border[1] - padding[1], top + border[0] + padding[0],
          right - border[1] - padding[1], bottom - border[2] - padding[2],
          left + border[3] + padding[3], bottom - border[2] - padding[2],
        ],
        padding: [
          left + border[3], top + border[0],
          right - border[1], top + border[0],
          right - border[1], bottom - border[2],
          left + border[3], bottom - border[2],
        ],
        border: [
          left, top,
          right, top,
          right, bottom,
          left, bottom,
        ],
        margin: [
          left - margin[3], top - margin[0],
          right + margin[1], top - margin[0],
          right + margin[1], bottom + margin[2],
          left - margin[3], bottom + margin[2],
        ],
      }
    };
  }

  private expandNode(node: Node): void {
    const nodeIds: number[] = [];
    let currentNode: Node | null = node;
    while (!nodes.hasNode(currentNode)) {
      const nodeId = nodes.getIdByNode(currentNode);
      nodeIds.unshift(nodeId);
      currentNode = currentNode.parentNode;
    }

    if (currentNode) {
      nodeIds.unshift(nodes.getIdByNode(currentNode));
    }

    nodeIds.forEach((nodeId) => {
      this.requestChildNodes({ nodeId });
    });
  }

  private setDomInspect(): void {
    document.addEventListener('click', (e) => {
      if (window.$$inspectMode !== 'searchForNode') return;

      e.stopPropagation();
      e.preventDefault();

      const previousNode = (e.target as Element).parentNode!;
      const currentNodeId = nodes.getIdByNode(e.target as Node);

      this.expandNode(previousNode);

      this.send({
        method: Event.nodeHighlightRequested,
        params: {
          nodeId: currentNodeId
        }
      });

      this.send({
        method: Event.inspectNodeRequested,
        params: {
          backendNodeId: currentNodeId
        }
      });

      document.getElementById(DEVTOOL_OVERLAY)!.style.display = 'none';
    }, true);
  }

  private nodeObserver(): void {
    const isDevtoolMutation = ({ target, addedNodes, removedNodes }: MutationRecord): boolean => {
      if (IGNORE_NODE.includes((target as Element).getAttribute?.('class') || '')) return true;
      if (IGNORE_NODE.includes((addedNodes[0] as Element)?.getAttribute?.('class') || '')) return true;
      if (IGNORE_NODE.includes((removedNodes[0] as Element)?.getAttribute?.('class') || '')) return true;
      return false;
    };

    const observer = new MutationObserver((mutationList) => {
      mutationList.forEach((mutation) => {
        const { attributeName, target, type, addedNodes, removedNodes } = mutation;

        // Ignore devtool dom changes
        if (isDevtoolMutation(mutation)) return;

        const parentNodeId = nodes.getIdByNode(target);

        const updateChildNodeCount = () => {
          this.send({
            method: Event.childNodeCountUpdated,
            params: {
              nodeId: parentNodeId,
              childNodeCount: nodes.getChildNodes(target).length,
            }
          });
        };

        switch (type) {
          case 'childList':
            addedNodes.forEach((node) => {
              updateChildNodeCount();
              this.send({
                method: Event.childNodeInserted,
                params: {
                  node: nodes.collectNodes(node, 0),
                  parentNodeId,
                  previousNodeId: nodes.getIdByNode(nodes.getPreviousNode(node)!)
                }
              });
            });

            removedNodes.forEach((node) => {
              updateChildNodeCount();
              const nodeId = nodes.getIdByNode(node);
              this.send({
                method: Event.childNodeRemoved,
                params: {
                  nodeId,
                  parentNodeId,
                }
              });
            });

            break;
          case 'attributes': {
            const value = (target as Element).getAttribute(attributeName!);
            this.send({
              method: value ? Event.attributeModified : Event.attributeRemoved,
              params: {
                nodeId: parentNodeId,
                value: value || undefined,
                name: attributeName,
              }
            });
            break;
          }

          case 'characterData':
            this.send({
              method: Event.characterDataModified,
              params: {
                nodeId: parentNodeId,
                characterData: target.nodeValue
              }
            });
            break;
        }
      });
    });

    // Observe the changes of the document
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }
}
