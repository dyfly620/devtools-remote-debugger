import Dom from './dom';
import DomStorage from './dom-storage';
import DomDebugger from './dom-debugger';
import Storage from './storage';
import Overlay from './overlay';
import Runtime from './runtime';
import Page from './page';
import Network from './network';
import Css from './css';
import SourceDebugger from './debugger';
import ScreenPreview from './screen-preview';
import protocol from './protocol';

export default class ChromeDomain {
  protocol: Record<string, (...args: any[]) => any> = {};

  constructor(options: { socket: any }) {
    this.registerProtocol(options);
    this.proxyAppendChild();
    this.proxyEventListener();
  }

  execute(message: { id: number; method: string; params?: any } = { id: 0, method: '' }): { id: number; result?: any } {
    const { id, method, params } = message;
    const methodCall = this.protocol[method];
    if (typeof methodCall !== 'function') return { id };

    return { id, result: methodCall(params) };
  }

  private registerProtocol(options: { socket: any }): void {
    const domains: any[] = [
      new Dom(options),
      new DomDebugger(options),
      new DomStorage(options),
      new Storage(options),
      new Overlay(options),
      new Runtime(options),
      new Page(options),
      new Network(options),
      new Css(options),
      new SourceDebugger(options),
      new ScreenPreview(options),
    ];

    domains.forEach((domain) => {
      const { namespace } = domain;
      const cmds = (protocol as any)[namespace];
      cmds.forEach((cmd: string) => {
        this.protocol[`${namespace}.${cmd}`] = domain[cmd].bind(domain);
      });
    });
  }

  private proxyAppendChild(): void {
    const originHeadAppendChild = HTMLHeadElement.prototype.appendChild;
    const originBodyAppendChild = HTMLBodyElement.prototype.appendChild;

    const fetchSource = (node: Node) => {
      const el = node as Element;
      const tag = el?.tagName?.toLowerCase();
      if (tag === 'link') {
        const url = el.getAttribute('href');
        const rel = el.getAttribute('rel');
        if (url && (!rel || rel === 'stylesheet')) {
          setTimeout(() => {
            this.protocol['CSS.getDynamicLink'](url);
          }, 300);
        }
      }

      if (tag === 'script') {
        const url = el.getAttribute('src');
        if (url) {
          setTimeout(() => {
            this.protocol['Debugger.getDynamicScript'](url);
          }, 300);
        }
      }
    };

    HTMLHeadElement.prototype.appendChild = function <T extends Node>(this: HTMLHeadElement, node: T): T {
      const result = originHeadAppendChild.call(this, node) as T;
      fetchSource(node);
      return result;
    };
    HTMLBodyElement.prototype.appendChild = function <T extends Node>(this: HTMLBodyElement, node: T): T {
      const result = originBodyAppendChild.call(this, node) as T;
      fetchSource(node);
      return result;
    };
  }

  private proxyEventListener(): void {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    const eventListenersMap = DomDebugger.eventListenersMap;

    EventTarget.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      optionOrUseCapture?: boolean | AddEventListenerOptions
    ) {
      let options: AddEventListenerOptions;
      if (typeof optionOrUseCapture === 'object' && optionOrUseCapture !== null) {
        options = optionOrUseCapture;
      } else {
        options = { capture: Boolean(optionOrUseCapture) };
      }

      const targetListeners = eventListenersMap.get(this) || {};
      if (!targetListeners[type]) {
        targetListeners[type] = [];
      }
      const data: any = {
        listener,
        once: options.once || false,
        passive: options.passive || false,
        capture: options.capture || false,
        useCapture: options.capture || false,
        type,
      };
      const callFrames = Runtime.getCallFrames(new Error('addEventListener'));
      for (let i = 0; i < callFrames.length; i++) {
        const callFrame = callFrames[i];
        if (callFrame.lineNumber && callFrame.columnNumber) {
          Object.assign(data, {
            lineNumber: callFrame.lineNumber,
            columnNumber: callFrame.columnNumber
          });
          break;
        }
      }
      targetListeners[type].push(data);
      eventListenersMap.set(this, targetListeners);

      return originalAddEventListener.apply(this, [type, listener, options]);
    };

    EventTarget.prototype.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      optionOrUseCapture?: boolean | EventListenerOptions
    ) {
      let options: EventListenerOptions;
      if (typeof optionOrUseCapture === 'object' && optionOrUseCapture !== null) {
        options = optionOrUseCapture;
      } else {
        options = { capture: Boolean(optionOrUseCapture) };
      }

      const targetListeners = eventListenersMap.get(this) || {};
      if (targetListeners[type]) {
        const index = targetListeners[type].findIndex((item: any) =>
          item.listener === listener &&
          item.once === ((options as any).once || false) &&
          item.passive === ((options as any).passive || false) &&
          item.capture === (options.capture || false)
        );
        if (index > -1) {
          targetListeners[type].splice(index, 1);
          if (targetListeners[type].length === 0) {
            delete targetListeners[type];
          }
        }
      }
      eventListenersMap.set(this, targetListeners);

      return originalRemoveEventListener.apply(this, [type, listener, options]);
    };

    (window as any).getEventListeners = function (target: EventTarget) {
      if (eventListenersMap.has(target)) {
        return Object.fromEntries(Object.entries(eventListenersMap.get(target)!).map(([key, value]) => {
          return [key, value.map((v: any) => {
            const { capture, listener, once, passive, type } = v;
            return { capture, listener, once, passive, type };
          })];
        }));
      } else {
        return {};
      }
    };
  }
}
