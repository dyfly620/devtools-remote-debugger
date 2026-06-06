/**
 * get absolute path
 */
export function getAbsolutePath(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const a = document.createElement('a');
  a.href = url;
  return a.href;
}

export function key2UpperCase(key: string): string {
  return key.replace(/^\S|-[a-z]/g, s => s.toUpperCase());
}

export function isMatches(element: Element, selector: string): boolean {
  // When some selectors in the safair kernel cannot be parsed, calling the matches method will throw an exception, which is captured here
  try {
    if (element.matches) {
      return element.matches(selector);
    }
    // deprecated
    if ((element as any).webkitMatchesSelector) {
      return (element as any).webkitMatchesSelector(selector);
    }
    if ((element as any).mozMatchesSelector) {
      return (element as any).mozMatchesSelector(selector);
    }
  } catch {
    return false;
  }
  return false;
}

export function isMobile(): boolean {
  return /ios|iphone|ipod|android/.test(navigator.userAgent.toLowerCase());
}

export function isSafari(): boolean {
  return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
}

export function isElement(node: Node): boolean {
  return node instanceof Element;
}

export function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.body.appendChild(script);
  });
}

export function escapeRegString(string: string): string {
  return string.replace(/[\\$*+?.^|(){}[\]]/g, '\\$&');
}
