import throttle from 'lodash.throttle';
import { isMobile, loadScript } from '../common/utils';
import BaseDomain from './domain';
import { Event } from './protocol';

export default class ScreenPreview extends BaseDomain {
  namespace = 'ScreenPreview';

  static captureScreen() {
    const renderScreen = () => window.snapdom.toCanvas(document.body)
      .then(canvas => canvas.toDataURL('image/jpeg'));

    if (window.snapdom) {
      return renderScreen();
    }

    return loadScript('https://unpkg.com/@zumer/snapdom@1.8.0/dist/snapdom.min.js').then(renderScreen);
  }

  /**
   * Start live preview
   * @public
   */
  startPreview() {
    const selector = 'link[rel="stylesheet"],style';
    const styles = document.querySelectorAll(selector);
    let counts = styles.length;

    const joinStyleTags = (styles) => {
      let tags = '';
      Array.from(styles).forEach(style => {
        const tag = style.tagName.toLowerCase();

        if (tag === 'link') {
          tags += `<link href="${style.href}" rel="stylesheet">`;
        }

        if (tag === 'style') {
          tags += `<style>${style.innerHTML}</style>`;
        }
      });
      return `<head>${tags}</head>`;
    };

    this.send({
      method: Event.captured,
      params: {
        isMobile: isMobile(),
        head: joinStyleTags(styles),
        body: document.body.innerHTML,
        width: window.innerWidth,
        height: window.innerHeight,
      }
    });

    // Observe the changes of the document
    this.observerInst = new MutationObserver(throttle(() => {
      const curStyles = document.querySelectorAll(selector);
      let head;
      if (curStyles.length !== counts) {
        counts = curStyles.length;
        head = joinStyleTags(curStyles);
      }

      this.send({
        method: Event.captured,
        params: {
          head,
          body: document.body.innerHTML,
          width: window.innerWidth,
          height: window.innerHeight,
          isMobile: isMobile(),
        }
      });
    }, 1000));

    this.observerInst.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    window.addEventListener('scroll', this.syncScroll);

    ['mousemove', 'mousedown', 'mouseup', 'touchmove', 'touchstart', 'touchend'].forEach(event => {
      window.addEventListener(event, this.syncMouse);
    });
  }

  /**
   * stop live preview
   * @public
   */
  stopPreview() {
    this.observerInst && this.observerInst.disconnect();
    window.removeEventListener('scroll', this.syncScroll);
    ['mousemove', 'mousedown', 'mouseup', 'touchmove', 'touchstart', 'touchend'].forEach(event => {
      window.removeEventListener(event, this.syncMouse);
    });
  }

  syncScroll = throttle(() => {
    const scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
    const scrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
    this.send({
      method: Event.syncScroll,
      params: {
        scrollTop,
        scrollLeft,
      },
    });
  }, 100);

  syncMouse = throttle((e) => {
    const type = e.type || 'mousemove';
    let left = e.clientX;
    let top = e.clientY;

    if (type.includes('touch')) {
      left = (e.touches[0] || e.changedTouches[0]).clientX;
      top = (e.touches[0] || e.changedTouches[0]).clientY;
    }

    this.send({
      method: Event.syncMouse,
      params: { type, left, top },
    });
  }, 50);
}
