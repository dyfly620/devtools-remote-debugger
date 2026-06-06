declare module 'string-random' {
  function uuid(): string;
  export default uuid;
}

declare module 'reconnecting-websocket' {
  export default class ReconnectingWebSocket {
    constructor(url: string, protocols?: string | string[], options?: Record<string, unknown>);
    send(data: string | ArrayBuffer | Blob): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
    readyState: number;
    url: string;
  }
}

declare module 'callsite' {
  function callsite(): Array<{
    getFunctionName(): string;
    getLineNumber(): number;
    getColumnNumber(): number;
    getFileName(): string;
  }> | string;
  export = callsite;
}

declare module 'js-cookie' {
  interface CookieAttributes {
    path?: string;
    domain?: string;
    expires?: number | Date;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  }
  function get(): Record<string, string>;
  function get(name: string): string | undefined;
  function set(name: string, value: string, options?: CookieAttributes): void;
  function remove(name: string, options?: Pick<CookieAttributes, 'path' | 'domain'>): void;
  export default { get, set, remove };
}

declare module 'mime/lite' {
  function getType(path: string): string | null;
  export { getType };
}

declare module 'lodash.throttle' {
  function throttle<T extends (...args: any[]) => any>(
    fn: T,
    wait?: number,
    options?: { leading?: boolean; trailing?: boolean }
  ): T;
  export default throttle;
}

declare module 'error-stack-parser' {
  interface StackFrame {
    functionName: string;
    fileName: string;
    lineNumber: number;
    columnNumber: number;
    source?: string;
    args?: any[];
  }
  function parse(error: Error): StackFrame[];
  export { StackFrame };
  export default { parse };
}

declare module 'specificity' {
  function calculate(selector: string): Array<{ specificityArray: number[] }>;
  function compare(a: number[], b: number[]): number;
  export { calculate, compare };
}

declare module 'image-to-base64' {
  function imageToBase64(url: string): Promise<string>;
  export = imageToBase64;
}

declare module 'dotenv-webpack' {
  import { Compiler } from 'webpack';
  interface DotenvOptions {
    path?: string;
    safe?: boolean | string;
    systemvars?: boolean;
    silent?: boolean;
    expand?: boolean;
    defaults?: boolean;
    ignoreStub?: boolean;
  }
  class Dotenv {
    constructor(options?: DotenvOptions);
    apply(compiler: Compiler): void;
  }
  export = Dotenv;
}

declare module 'unplugin-auto-import/webpack' {
  import { Compiler } from 'webpack';
  function AutoImport(options: any): { apply(compiler: Compiler): void };
  export = AutoImport;
}

declare module 'unplugin-vue-components/webpack' {
  import { Compiler } from 'webpack';
  function Components(options: any): { apply(compiler: Compiler): void };
  export = Components;
}

declare module 'unplugin-vue-components/resolvers' {
  function ElementPlusResolver(): any;
  export { ElementPlusResolver };
}
