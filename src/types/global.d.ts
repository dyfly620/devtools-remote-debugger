// Browser global type extensions
interface Window {
  $: (selector: string) => Element | null;
  $$: (selector: string) => NodeListOf<Element>;
  $x: (selector: string) => Element[];
  $_: any;
  $0: Element | null;
  $$inspectMode?: string;
  snapdom?: {
    toCanvas(element: HTMLElement): Promise<HTMLCanvasElement>;
  };
  getEventListeners?: (target: EventTarget) => Record<string, Array<{
    capture: boolean;
    listener: EventListener;
    once: boolean;
    passive: boolean;
    type: string;
  }>>;
}

interface XMLHttpRequest {
  $$request?: {
    method: string;
    url: string;
    requestId: number;
    headers: Record<string, string>;
    postData?: any;
    hasPostData?: boolean;
  };
  $$requestType?: string;
}

interface CSSStyleSheet {
  styleSheetId?: string;
  devToolsOverrideStyle?: HTMLStyleElement;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
