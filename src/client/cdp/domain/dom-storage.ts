import BaseDomain from './domain';
import { Event } from './protocol';

interface StorageId {
  isLocalStorage: boolean;
  securityOrigin: string;
  storageKey: string;
}

export default class DomStorage extends BaseDomain {
  namespace = 'DOMStorage';

  static getStorage(storageId: StorageId | { isLocalStorage: boolean }): Storage {
    return storageId.isLocalStorage ? localStorage : sessionStorage;
  }

  enable(): void {
    this.hookStorage(localStorage);
    this.hookStorage(sessionStorage);
  }

  getDOMStorageItems({ storageId }: { storageId: StorageId }): { entries: [string, string][] } {
    const storage = DomStorage.getStorage(storageId);
    return { entries: Object.entries(storage) };
  }

  removeDOMStorageItem({ key, storageId }: { key: string; storageId: StorageId }): void {
    const storage = DomStorage.getStorage(storageId);
    storage.removeItem(key);

    this.send({
      method: Event.domStorageItemRemoved,
      params: { key, storageId }
    });
  }

  clear({ storageId }: { storageId: StorageId }): void {
    const storage = DomStorage.getStorage(storageId);
    storage.clear();

    this.send({
      method: Event.domStorageItemsCleared,
      params: { storageId },
    });
  }

  setDOMStorageItem({ storageId, key, value }: { storageId: StorageId; key: string; value: string }): void {
    const storage = DomStorage.getStorage(storageId);
    storage.setItem(key, value);
  }

  private hookStorage(storage: Storage): void {
    const _this = this;

    const storageId: StorageId = {
      isLocalStorage: storage === localStorage,
      securityOrigin: location.origin,
      storageKey: location.origin,
    };

    const {
      setItem: nativeSetItem,
      removeItem: nativeRemoveItem,
      clear: nativeClear,
    } = Storage.prototype;

    Storage.prototype.setItem = function (this: Storage, key: string, newValue: string) {
      const isKeyExisted = Object.keys(storage).includes(key);
      const oldValue = this.getItem(key);
      nativeSetItem.call(this, key, newValue);

      _this.send({
        method: isKeyExisted ? Event.domStorageItemUpdated : Event.domStorageItemAdded,
        params: {
          storageId,
          key,
          newValue,
          oldValue,
        }
      });
    };

    Storage.prototype.removeItem = function (this: Storage, key: string) {
      nativeRemoveItem.call(this, key);

      _this.send({
        method: Event.domStorageItemRemoved,
        params: { storageId, key }
      });
    };

    Storage.prototype.clear = function (this: Storage) {
      nativeClear.call(this);

      _this.send({
        method: Event.domStorageItemsCleared,
        params: { storageId }
      });
    };
  }
}
