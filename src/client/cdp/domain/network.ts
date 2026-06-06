import jsCookie from 'js-cookie';
import mime from 'mime/lite';
import { getAbsolutePath, key2UpperCase } from '../common/utils';
import BaseDomain from './domain';
import { Event } from './protocol';

const getTimestamp = (): number => Date.now() / 1000;

const originFetch = window.fetch;

interface SendRequest {
  method: string;
  url: string;
  requestId: number;
  headers: Record<string, string>;
  postData?: any;
  hasPostData?: boolean;
}

interface NetworkEventParams {
  requestId: number;
  url: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  headersText?: string;
  type?: string;
  blockedCookies: any[];
  encodedDataLength?: number;
}

export default class Network extends BaseDomain {
  namespace = 'Network';

  // the unique id of the request
  requestId = 0;

  responseData = new Map<number, any>();

  cacheRequest: any[] = [];

  isEnable = false;

  socketSend = (data: any): void => {
    this.cacheRequest.push(data);
    if (this.isEnable) {
      this.send(data);
    }
  };

  constructor(options: { socket: any }) {
    super(options);
    this.hookXhr();
    this.hookFetch();
  }

  static formatResponseHeader(header: string): Record<string, string> {
    const headers: Record<string, string> = {};
    header.split('\n').filter(val => val)
      .forEach((item) => {
        const [key, val] = item.split(':');
        headers[key2UpperCase(key)] = val;
      });
    return headers;
  }

  static getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': navigator.userAgent,
    };
    if (document.cookie) {
      headers.Cookie = document.cookie;
    }

    return headers;
  }

  enable(): void {
    this.isEnable = true;
    this.cacheRequest.forEach(data => this.send(data));
    this.reportImageNetwork();
  }

  getResponseBody({ requestId }: { requestId: number }): { body: any; base64Encoded: boolean } {
    let body: any = '';
    let base64Encoded = false;
    const response = this.responseData.get(requestId);

    if (typeof response === 'string') {
      body = response;
    } else {
      body = response?.data;
      base64Encoded = true;
    }

    return { body, base64Encoded };
  }

  getCookies(): { cookies: Array<{ name: string; value: string }> } {
    const cookies = jsCookie.get();
    return {
      cookies: Object.keys(cookies).map(name => ({ name, value: cookies[name] }))
    };
  }

  deleteCookies({ name }: { name: string }): void {
    jsCookie.remove(name, { path: '/' });
  }

  setCookie({ name, value, path }: { name: string; value: string; path?: string }): void {
    jsCookie.set(name, value, { path });
  }

  private getRequestId(): number {
    this.requestId += 1;
    return this.requestId;
  }

  private hookXhr(): void {
    const instance = this;
    const xhrSend = XMLHttpRequest.prototype.send;
    const xhrOpen = XMLHttpRequest.prototype.open;
    const xhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...params: any[]) {
      const [method, url] = params;
      this.$$request = {
        method,
        url: getAbsolutePath(url),
        requestId: instance.getRequestId(),
        headers: Network.getDefaultHeaders(),
      };

      xhrOpen.apply(this, params as any);
    };

    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, data?: any) {
      xhrSend.call(this, data);

      const request = this.$$request!;
      const { requestId, url, method } = request;
      if (method.toLowerCase() === 'post') {
        request.postData = data;
        request.hasPostData = !!data;
      }

      instance.socketSend({
        method: Event.requestWillBeSent,
        params: {
          requestId,
          request,
          documentURL: location.href,
          timestamp: getTimestamp(),
          wallTime: Date.now(),
          type: this.$$requestType || 'XHR',
        }
      });

      this.addEventListener('readystatechange', () => {
        // After the request is completed, get the http response header
        if (this.readyState === 4) {
          const headers = this.getAllResponseHeaders();
          const responseHeaders = Network.formatResponseHeader(headers);
          instance.sendNetworkEvent({
            requestId,
            url: getAbsolutePath(url),
            headers: responseHeaders,
            blockedCookies: [],
            headersText: headers,
            type: this.$$requestType || 'XHR',
            status: this.status,
            statusText: this.statusText,
            encodedDataLength: Number(this.getResponseHeader('Content-Length')),
          });
        }
      });

      this.addEventListener('load', () => {
        if (this.responseType === '' || this.responseType === 'text') {
          // Cache the response result after the request ends, which will be used when getResponseBody
          instance.responseData.set(this.$$request!.requestId, this.responseText);
        }
      });
    };

    XMLHttpRequest.prototype.setRequestHeader = function (this: XMLHttpRequest, key: string, value: string) {
      if (this.$$request) {
        this.$$request.headers[key] = String(value);
      }
      xhrSetRequestHeader.call(this, key, value);
    };
  }

  private hookFetch(): void {
    const instance = this;
    window.fetch = function (request: RequestInfo, initConfig: RequestInit = {}) {
      let url: string;
      let method: string;
      let data: any = '';
      // When request is a string, it is the requested url
      if (typeof request === 'string' || request instanceof URL) {
        url = request.toString();
        method = (initConfig.method || 'get');
        data = initConfig.body;
      } else {
        // Otherwise it is a Request object
        ({ url, method } = request);
      }

      url = getAbsolutePath(url);
      const requestId = instance.getRequestId();
      const sendRequest: SendRequest = {
        url,
        method,
        requestId,
        headers: Network.getDefaultHeaders(),
      };

      if (method.toLowerCase() === 'post') {
        sendRequest.postData = data;
        sendRequest.hasPostData = !!data;
      }

      instance.socketSend({
        method: Event.requestWillBeSent,
        params: {
          requestId,
          documentURL: location.href,
          timestamp: getTimestamp(),
          wallTime: Date.now(),
          type: 'Fetch',
          request: sendRequest,
        }
      });

      let oriResponse: Response;
      return originFetch(request, initConfig).then((response) => {
        // Temporarily save the raw response to the request
        oriResponse = response;

        const { headers, status, statusText } = response;
        const responseHeaders: Record<string, string> = {};
        let headersText = '';
        headers.forEach((val, key) => {
          const upperKey = key2UpperCase(key);
          responseHeaders[upperKey] = val;
          headersText += `${upperKey}: ${val}\r\n`;
        });

        instance.sendNetworkEvent({
          url,
          requestId,
          status,
          statusText,
          headersText,
          type: 'Fetch',
          blockedCookies: [],
          headers: responseHeaders,
          encodedDataLength: Number(headers.get('Content-Length')),
        });

        const contentType = headers.get('Content-Type') || '';
        if (['application/json', 'application/javascript', 'text/plain', 'text/html', 'text/css'].some(type => contentType.includes(type))) {
          return response.clone().text();
        }
        return '';
      })
        .then((responseBody) => {
          instance.responseData.set(requestId, responseBody);
          // Returns the raw response to the request
          return oriResponse;
        })
        .catch((error) => {
          instance.sendNetworkEvent({
            url,
            requestId,
            blockedCookies: [],
            type: 'Fetch',
          });
          throw error;
        });
    } as typeof window.fetch;
  }

  private reportImageNetwork(): void {
    const imgUrls = new Set<string>();

    const reportNetwork = (urls: string[]): void => {
      urls.forEach(async (url) => {
        const requestId = this.getRequestId();

        try {
          const { base64 } = await originFetch(
            `${process.env.DEBUG_HOST}/remote/debug/image_base64?url=${encodeURIComponent(url)}`
          )
            .then(res => res.json());

          this.responseData.set(requestId, {
            data: base64,
            base64Encoded: true,
          });
        } catch {
          // nothing to do
        }

        this.send({
          method: Event.requestWillBeSent,
          params: {
            requestId,
            documentURL: location.href,
            timestamp: getTimestamp(),
            wallTime: Date.now(),
            type: 'Image',
            request: { method: 'GET', url },
          }
        });

        this.sendNetworkEvent({
          url,
          requestId,
          status: 200,
          statusText: '',
          headersText: '',
          type: 'Image',
          blockedCookies: [],
          encodedDataLength: 0,
        });
      });
    };

    const getImageUrls = (): string[] => {
      const urls: string[] = [];
      Object.values(document.images).forEach(image => {
        const url = image.getAttribute('src');
        if (url && !imgUrls.has(url)) {
          imgUrls.add(url);
          urls.push(url);
        }
      });
      return urls;
    };

    const observerBodyMutation = (): void => {
      const observer = new MutationObserver(() => {
        const urls = getImageUrls();
        if (urls.length) {
          reportNetwork(urls);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    };

    reportNetwork(getImageUrls());
    observerBodyMutation();
  }

  private sendNetworkEvent(params: NetworkEventParams): void {
    const {
      requestId, headers, headersText, type, url,
      status, statusText, encodedDataLength,
    } = params;

    this.socketSend({
      method: Event.responseReceivedExtraInfo,
      params: { requestId, headers, blockedCookies: [], headersText },
    });

    this.socketSend({
      method: Event.responseReceived,
      params: {
        type,
        requestId,
        timestamp: getTimestamp(),
        response: { url, status, statusText, headers, mimeType: mime.getType(url) }
      },
    });

    setTimeout(() => {
      // loadingFinished event delay report
      this.socketSend({
        method: Event.loadingFinished,
        params: {
          requestId,
          encodedDataLength,
          timestamp: getTimestamp(),
        },
      });
    }, 10);
  }
}
