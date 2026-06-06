import BaseDomain from './domain';

export default class Storage extends BaseDomain {
  namespace = 'Storage';

  getStorageKeyForFrame(): { storageKey: string } {
    return {
      storageKey: location.origin
    };
  }
}
