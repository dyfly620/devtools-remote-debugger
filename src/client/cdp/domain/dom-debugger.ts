import BaseDomain from './domain';
import { getObjectById, objectFormat } from '../common/remoteObject';
import nodes from '../common/nodes';

interface EventListenerInfo extends AddEventListenerOptions {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  listener: Function;
  type: string;
  scriptId?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export default class DomDebugger extends BaseDomain {
  namespace = 'DOMDebugger';

  static eventListenersMap = new WeakMap<EventTarget, Record<string, EventListenerInfo[]>>();

  getEventListeners({ objectId }: { objectId: string }): { listeners: any[] } {
    const node = getObjectById(objectId) as EventTarget;
    const listeners = DomDebugger.eventListenersMap.get(node) || {};
    return {
      listeners: Object.values(listeners).flat().map(v => {
        const copy: any = { ...v };
        delete copy.listener;
        copy.handler = copy.originalHandler = objectFormat(v.listener);
        delete copy.capture;
        copy.backendNodeId = nodes.getIdByNode(node as any);
        return copy;
      })
    };
  }
}
