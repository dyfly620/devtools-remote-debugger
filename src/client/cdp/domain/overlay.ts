import nodes from '../common/nodes';
import BaseDomain from './domain';
import { DEVTOOL_OVERLAY } from '../common/constant';
import { Event } from './protocol';

interface HighlightColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface HighlightConfig {
  contentColor?: HighlightColor;
  paddingColor?: HighlightColor;
  marginColor?: HighlightColor;
}

interface HighlightBox {
  containerBox?: HTMLDivElement;
  contentBox?: HTMLDivElement;
  marginBox?: HTMLDivElement;
  tooltipsBox?: HTMLDivElement;
}

export default class Overlay extends BaseDomain {
  namespace = 'Overlay';

  highlightConfig: HighlightConfig = {};

  highlightBox: HighlightBox = {};

  static formatNumber(num: number): string {
    if (num % 1 === 0) return String(num);

    const fixed = num.toFixed(2);
    const numArr = fixed.split('.');
    if (numArr[1] === '00') return numArr[0];
    return fixed;
  }

  static getStylePropertyValue(properties: string[] | string, styles: CSSStyleDeclaration): number | number[] {
    if (Array.isArray(properties)) {
      return properties.map((key) => Number(styles.getPropertyValue(key).replace('px', '')));
    }

    return Number(styles.getPropertyValue(properties).replace('px', ''));
  }

  static rgba({ r, g, b, a }: HighlightColor = { r: 0, g: 0, b: 0, a: 1 }): string {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  enable(): void {
    this.createHighlightBox();
    this.nodeHighlightRequested();
  }

  highlightNode({ nodeId, nodeElement, highlightConfig }: {
    nodeId?: string;
    nodeElement?: HTMLElement;
    highlightConfig?: HighlightConfig;
  }): void {
    const node = nodeElement || nodes.getNodeById(nodeId as any) as HTMLElement;
    if (
      !node ||
      [Node.TEXT_NODE, Node.COMMENT_NODE, Node.DOCUMENT_TYPE_NODE].includes(node.nodeType as any) ||
      ['LINK', 'SCRIPT', 'HEAD'].includes(node.nodeName) ||
      !(node instanceof HTMLElement) ||
      window.getComputedStyle(node).display === 'none'
    ) {
      return;
    }

    this.updateHighlightBox(highlightConfig || {}, node);
  }

  hideHighlight(): void {
    if (this.highlightBox.containerBox) {
      this.highlightBox.containerBox.style.display = 'none';
    }
  }

  setInspectMode({ mode, highlightConfig }: { mode: string; highlightConfig: HighlightConfig }): void {
    window.$$inspectMode = mode;
    this.highlightConfig = highlightConfig;
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

  private requestChildNodes({ nodeId }: { nodeId: number }): void {
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

  private nodeHighlightRequested(): void {
    const highlight = (e: Event) => {
      if (window.$$inspectMode !== 'searchForNode') return;
      e.stopPropagation();
      e.preventDefault();

      let { target } = e;

      if ((e as TouchEvent).touches) {
        const touch = (e as TouchEvent).touches[0];
        target = document.elementFromPoint(touch.clientX, touch.clientY) as Element;
      }

      this.highlightNode({
        nodeElement: target as HTMLElement,
        highlightConfig: this.highlightConfig,
      });

      this.expandNode((target as HTMLElement).parentNode!);

      this.send({
        method: Event.nodeHighlightRequested,
        params: {
          nodeId: nodes.getIdByNode(target as Node),
        },
      });
    };

    document.addEventListener('mousemove', highlight, true);
    document.addEventListener('touchmove', highlight, { passive: false });
  }

  private createHighlightBox(): void {
    const containerBox = document.createElement('div');
    const contentBox = document.createElement('div');
    const marginBox = document.createElement('div');
    const tooltipsBox = document.createElement('div');

    [marginBox, contentBox, tooltipsBox].forEach((item) => {
      Object.assign(item.style, {
        padding: 0,
        margin: 0,
        position: 'fixed',
        borderSizing: 'border-box',
      });
      item.className = DEVTOOL_OVERLAY;
      containerBox.appendChild(item);
    });

    Object.assign(containerBox.style, {
      display: 'none',
      position: 'fixed',
      zIndex: 99999,
      pointerEvents: 'none',
      textShadow: 'none',
    });

    containerBox.className = DEVTOOL_OVERLAY;
    containerBox.id = DEVTOOL_OVERLAY;
    containerBox.setAttribute('data-capture', 'exclude');
    document.body.appendChild(containerBox);

    this.highlightBox = { containerBox, contentBox, marginBox, tooltipsBox };
  }

  private updateHighlightBox(highlightConfig: HighlightConfig, node: HTMLElement): void {
    const styles = window.getComputedStyle(node);
    const margin = Overlay.getStylePropertyValue([
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left'
    ], styles) as number[];
    const padding = Overlay.getStylePropertyValue([
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left'
    ], styles) as number[];
    const border = Overlay.getStylePropertyValue([
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width'
    ], styles) as number[];
    const width = Overlay.getStylePropertyValue('width', styles) as number;
    const height = Overlay.getStylePropertyValue('height', styles) as number;
    const isBorderBox = window.getComputedStyle(node)['box-sizing'] === 'border-box';
    const { left, top } = node.getBoundingClientRect();

    const contentWidth = isBorderBox ? width - padding[1] - padding[3] : width + border[1] + border[3];
    const contentHeight = isBorderBox ? height - padding[0] - padding[2] : height + border[0] + border[2];
    const marginWidth = isBorderBox ? width : width + padding[1] + padding[3] + border[1] + border[3];
    const marginHeight = isBorderBox ? height : height + padding[0] + padding[2] + border[0] + border[2];

    const { contentColor, paddingColor, marginColor } = highlightConfig || {};
    const { containerBox, contentBox, marginBox, tooltipsBox } = this.highlightBox;

    if (containerBox) containerBox.style.display = 'block';

    if (contentBox) {
      Object.assign(contentBox.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${contentWidth}px`,
        height: `${contentHeight}px`,
        background: Overlay.rgba(contentColor),
        borderColor: Overlay.rgba(paddingColor),
        borderStyle: 'solid',
        borderWidth: `${padding[0]}px ${padding[1]}px ${padding[2]}px ${padding[3]}px`
      });
    }

    if (marginBox) {
      Object.assign(marginBox.style, {
        left: `${left - margin[3]}px`,
        top: `${top - margin[0]}px`,
        width: `${marginWidth}px`,
        height: `${marginHeight}px`,
        borderColor: Overlay.rgba(marginColor),
        borderStyle: 'solid',
        borderWidth: `${margin[0]}px ${margin[1]}px ${margin[2]}px ${margin[3]}px`
      });
    }

    const isTopPosition = top - margin[0] > 25;
    const cls = DEVTOOL_OVERLAY;
    const currentClassName = node.getAttribute('class');
    if (tooltipsBox) {
      tooltipsBox.innerHTML = `
        <span class="${cls}" style="color:#973090;font-weight:bold">${node.nodeName.toLowerCase()}</span>
        <span class="${cls}" style="color:#3434B0;font-weight:bold">${currentClassName ? `.${currentClassName}` : ''}</span>
        <span class="${cls}" style="position:absolute;top:${isTopPosition ? 'auto' : '-4px'};bottom:${isTopPosition ? '-4px' : 'auto'};left:10px;width:8px;height:8px;background:#fff;transform:rotate(45deg);"></span>
        ${Overlay.formatNumber(contentWidth)} x ${Overlay.formatNumber(contentHeight)}
      `;

      Object.assign(tooltipsBox.style, {
        background: '#fff',
        left: `${left - margin[3]}px`,
        top: isTopPosition ? `${top - margin[0] - 30}px` : `${top + marginHeight + 10}px`,
        filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.3))',
        'border-radius': '2px',
        'font-size': '12px',
        padding: '2px 4px',
        color: '#8d8d8d',
      });
    }
  }
}
