import ErrorStackParser from 'error-stack-parser';
import callsite from 'callsite';
import { objectFormat, objectRelease, getObjectProperties, getObjectById } from '../common/remoteObject';
import { isSafari } from '../common/utils';
import BaseDomain from './domain';
import { Event } from './protocol';

interface CallFrame {
  functionName: string;
  lineNumber?: number;
  columnNumber?: number;
  url: string;
  [key: string]: any;
}

export default class Runtime extends BaseDomain {
  namespace = 'Runtime';

  cacheConsole: any[] = [];

  cacheError: any[] = [];

  isEnable = false;

  socketSend = (type: 'console' | 'error', data: any): void => {
    if (type === 'console') {
      this.cacheConsole.push(data);
    } else if (type === 'error') {
      this.cacheError.push(data);
    }
    if (this.isEnable) {
      this.send(data);
    }
  };

  static setCommandLineApi(): void {
    window.$_ = undefined;

    if (typeof (window as any).clear !== 'function') {
      (window as any).clear = () => console.clear();
    }

    if (typeof (window as any).copy !== 'function') {
      (window as any).copy = (object: any) => {
        function fallbackCopyTextToClipboard(text: string) {
          if (typeof document !== 'object') {
            console.error('Copy text failed, running environment is not a browser');
          }
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.top = '0';
          textArea.style.left = '0';
          textArea.style.width = '1px';
          textArea.style.height = '1px';
          textArea.style.padding = '0';
          textArea.style.border = 'none';
          textArea.style.outline = 'none';
          textArea.style.boxShadow = 'none';
          textArea.style.background = 'transparent';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            const successful = document.execCommand('copy');
            if (!successful) console.error('Unable to copy using execCommand');
          } catch (err) {
            console.error('Unable to copy using execCommand:', err);
          }
          document.body.removeChild(textArea);
        }
        const str = String(object);
        if ('clipboard' in navigator) {
          navigator.clipboard.writeText(str).catch(() => {
            fallbackCopyTextToClipboard(str);
          });
        } else {
          fallbackCopyTextToClipboard(str);
        }
      };
    }

    if (typeof (window as any).dir !== 'function') {
      (window as any).dir = (object: any) => console.dir(object);
    }

    if (typeof (window as any).dirxml !== 'function') {
      (window as any).dirxml = (object: any) => console.dirxml(object);
    }

    if (typeof (window as any).keys !== 'function') {
      (window as any).keys = (object: any) => Object.keys(object);
    }

    if (typeof (window as any).values !== 'function') {
      (window as any).values = (object: any) => Object.values(object);
    }

    if (typeof (window as any).table !== 'function') {
      (window as any).table = (object: any) => console.table(object);
    }
  }

  constructor(options: { socket: any }) {
    super(options);
    this.hookConsole();
    this.listenError();
  }

  static getCallFrames(error?: Error): CallFrame[] {
    let callFrames: any[] = [];

    // Helper function to process stack frames
    const processFrames = (frames: any[]): CallFrame[] => {
      return frames.map(frame => ({
        ...frame,
        url: frame.fileName || (typeof frame.getFileName === 'function' ? frame.getFileName() : '') || '',
      }));
    };

    // Case 1: Error object provided
    if (error) {
      callFrames = ErrorStackParser.parse(error);
    } else if ((Error as any).captureStackTrace) {
      // Case 2: Error.captureStackTrace available
      const errorStack = callsite();
      if (typeof errorStack === 'string') {
        // Safari's stack returns a string
        callFrames = ErrorStackParser.parse(new Error(errorStack));
      } else {
        // V8's stack returns an array
        callFrames = errorStack.map((val: any) => ({
          functionName: val.getFunctionName(),
          lineNumber: val.getLineNumber(),
          columnNumber: val.getColumnNumber(),
          url: val.getFileName(),
        }));
      }
    } else {
      // Case 3: Default case (create a new Error object)
      callFrames = ErrorStackParser.parse(new Error());
    }

    return processFrames(callFrames);
  }

  enable(): void {
    this.isEnable = true;
    this.cacheConsole.forEach(data => this.send(data));
    this.cacheError.forEach(data => this.send(data));

    this.send({
      method: Event.executionContextCreated,
      params: {
        context: {
          id: 1,
          name: 'top',
          origin: location.origin,
        }
      }
    });
    Runtime.setCommandLineApi();
  }

  evaluate({ expression, generatePreview }: { expression: string; generatePreview?: boolean }): { result: ReturnType<typeof objectFormat> } {
    // Modifying the scope to the global scope enables variables defined
    // with var to be accessible globally.
    // eslint-disable-next-line
    const res = window.eval(expression);
    // chrome-api
    window.$_ = res;
    return {
      result: objectFormat(res, { preview: generatePreview }),
    };
  }

  getProperties(params: any): { result: ReturnType<typeof getObjectProperties> } {
    return {
      result: getObjectProperties(params),
    };
  }

  releaseObject(params: { objectId: string }): void {
    objectRelease(params);
  }

  callFunctionOn({ functionDeclaration, objectId, arguments: args, silent }: {
    functionDeclaration: string;
    objectId?: string;
    arguments?: any[];
    silent?: boolean;
  }): any {
    /* eslint-disable-next-line no-eval, @typescript-eslint/no-unsafe-function-type */
    const fun: Function = eval(`(() => ${functionDeclaration})()`);
    if (Array.isArray(args)) {
      args = args.map(v => {
        if ('value' in v) return v.value;
        if ('objectId' in v) return getObjectById(v.objectId);
        return undefined;
      });
    }
    if (silent === true) {
      try {
        return fun.apply(objectId ? getObjectById(objectId) : null, args);
      } catch {
        // silently ignore
      }
    } else {
      return fun.apply(objectId ? getObjectById(objectId) : null, args);
    }
  }

  private hookConsole(): void {
    const methods: Record<string, string> = {
      log: 'log',
      debug: 'debug',
      info: 'info',
      error: 'error',
      warn: 'warning',
      dir: 'dir',
      dirxml: 'dirxml',
      table: 'table',
      trace: 'trace',
      clear: 'clear',
      group: 'startGroup',
      groupCollapsed: 'startGroupCollapsed',
      groupEnd: 'endGroup',
    };

    Object.keys(methods).forEach((key) => {
      const nativeConsoleFunc = (window.console as any)[key];
      (window.console as any)[key] = (...args: any[]) => {
        nativeConsoleFunc?.(...args);
        const data = {
          method: Event.consoleAPICalled,
          params: {
            type: methods[key],
            args: args.map(arg => objectFormat(arg, { preview: true })),
            executionContextId: 1,
            timestamp: Date.now(),
            stackTrace: {
              // processing call stack
              callFrames: ['error', 'warn', 'trace', 'assert'].includes(key) ? Runtime.getCallFrames() : [],
            }
          }
        };
        this.socketSend('console', data);
      };
    });
  }

  private listenError(): void {
    const exceptionThrown = (error?: Error | any) => {
      let desc = error ? error.stack : 'Script error.';

      if (isSafari() && error) {
        desc = `${error.name}: ${error.message}\n    at (${error.sourceURL}:${error.line}:${error.column})`;
      }

      const data = {
        method: Event.exceptionThrown,
        params: {
          timestamp: Date.now(),
          exceptionDetails: {
            text: 'Uncaught',
            exception: {
              type: 'object',
              subtype: 'error',
              className: error ? error.name : 'Error',
              description: desc,
            },
            stackTrace: {
              callFrames: Runtime.getCallFrames(error)
            },
          }
        }
      };
      this.socketSend('error', data);
    };

    window.addEventListener('error', e => exceptionThrown(e.error));
    window.addEventListener('unhandledrejection', e => exceptionThrown(e.reason));
  }
}
