import ScreenPreview from './screen-preview';
import BaseDomain from './domain';
import { Event } from './protocol';

export default class Page extends BaseDomain {
  namespace = 'Page';

  frame = new Map<string, string>();

  static MAINFRAME_ID = 1;

  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  enable(): void {
    const xhr = new XMLHttpRequest();
    xhr.$$requestType = 'Document';
    xhr.onload = () => {
      this.frame.set(location.href, xhr.responseText);
    };
    xhr.onerror = () => {
      this.frame.set(location.href, 'Cannot get script source code');
    };

    xhr.open('GET', location.href);
    xhr.send();
  }

  getResourceTree(): { frameTree: { frame: Record<string, unknown>; resources: never[] } } {
    return {
      frameTree: {
        frame: {
          id: 1,
          mimeType: 'text/html',
          securityOrigin: location.origin,
          url: location.href,
        },
        resources: [],
      },
    };
  }

  getResourceContent({ url }: { url: string }): { content: string | undefined } {
    return {
      content: this.frame.get(url),
    };
  }

  startScreencast(): void {
    const captureScreen = () => {
      if (document.hidden) return;
      ScreenPreview.captureScreen().then((base64) => {
        this.send({
          method: Event.screencastFrame,
          params: {
            data: base64.replace(/^data:image\/jpeg;base64,/, ''),
            sessionId: 1,
            metadata: {
              deviceHeight: window.innerHeight,
              deviceWidth: window.innerWidth,
              pageScaleFactor: 1,
              offsetTop: 0,
              scrollOffsetX: 0,
              scrollOffsetY: 0,
              timestamp: Date.now()
            }
          }
        });
      });
    };

    captureScreen();

    this.intervalTimer = setInterval(captureScreen, 1000);
  }

  stopScreencast(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}
