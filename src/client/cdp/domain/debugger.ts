import BaseDomain from './domain';
import { getAbsolutePath } from '../common/utils';
import { Event } from './protocol';

export default class Debugger extends BaseDomain {
  namespace = 'Debugger';

  // collection of javascript scripts
  scripts = new Map<string, string>();

  // Unique id for javascript scripts
  scriptId = 0;

  enable(): void {
    const scripts = this.collectScripts();
    scripts.forEach(({ scriptId, url }) => {
      this.send({
        method: Event.scriptParsed,
        params: {
          scriptId,
          startColumn: 0,
          startLine: 0,
          endColumn: 999999,
          endLine: 999999,
          scriptLanguage: 'JavaScript',
          url,
        }
      });
    });
  }

  getScriptSource({ scriptId }: { scriptId: string }): { scriptSource: string | undefined } {
    return {
      scriptSource: this.getScriptSourceById(scriptId)
    };
  }

  getDynamicScript(url: string): void {
    const scriptId = this.getScriptId();
    this.fetchScriptSource(scriptId, getAbsolutePath(url));
    this.send({
      method: Event.scriptParsed,
      params: {
        url,
        scriptId,
        startColumn: 0,
        startLine: 0,
        endColumn: 999999,
        endLine: 999999,
        scriptLanguage: 'JavaScript',
      }
    });
  }

  private collectScripts(): Array<{ scriptId: string; url: string }> {
    const scriptElements = document.querySelectorAll('script');
    const ret: Array<{ scriptId: string; url: string }> = [];
    scriptElements.forEach((script) => {
      const scriptId = this.getScriptId();
      const src = script.getAttribute('src');
      if (src) {
        const url = getAbsolutePath(src);
        ret.push({ scriptId, url });
        this.fetchScriptSource(scriptId, url);
      }
    });
    return ret;
  }

  private fetchScriptSource(scriptId: string, url: string): void {
    const xhr = new XMLHttpRequest();
    xhr.$$requestType = 'Script';
    xhr.onload = () => {
      this.scripts.set(scriptId, xhr.responseText);
    };
    xhr.onerror = () => {
      this.scripts.set(scriptId, 'Cannot get script source code');
    };

    xhr.open('GET', url);
    xhr.send();
  }

  private getScriptSourceById(scriptId: string): string | undefined {
    return this.scripts.get(scriptId);
  }

  private getScriptId(): string {
    this.scriptId += 1;
    return `${this.scriptId}`;
  }
}
