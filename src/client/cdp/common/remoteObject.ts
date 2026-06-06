const objectIds = new Map<object, string>();
const objects = new Map<string, object>();
const origins = new Map<string, object>();
let currentId = 1;

interface TypeInfo {
  type: string;
  subtype: string;
}

interface PreviewProperty {
  name: string;
  type: string;
  subtype: string;
  value: string;
}

interface ObjectPreview {
  overflow: boolean;
  properties: PreviewProperty[];
}

interface RemoteObject {
  type: string;
  subtype?: string;
  value?: any;
  description?: string;
  objectId?: string;
  className?: string;
  preview?: ObjectPreview & {
    type?: string;
    subtype?: string;
    description?: string;
  };
}

interface ObjectFormatOptions {
  origin?: any;
  preview?: boolean;
  length?: number;
}

interface GetPropertiesParams {
  accessorPropertiesOnly?: boolean;
  generatePreview?: boolean;
  objectId: string;
  ownProperties?: boolean;
}

interface PropertyDescriptor {
  name: string;
  configurable: boolean;
  enumerable: boolean;
  writable: boolean;
  isOwn: boolean;
  value: RemoteObject;
}

const getIdByObject = (object: object, origin: object): string => {
  let id = objectIds.get(object);
  if (id) return id;

  id = `${currentId++}`;
  objects.set(id, object);
  objectIds.set(object, id);
  origins.set(id, origin);
  return id;
};

const getRealType = (val: any): string => {
  const reg = /\[object\s+(.*)\]/;
  const res = reg.exec(Object.prototype.toString.call(val));
  return res ? res[1] : '';
};

const getSubType = (val: any): string => {
  // DOM node type
  try {
    if (val && [1, 8, 9].includes(val.nodeType)) return 'node';
  } catch { }

  const realType = getRealType(val).toLowerCase();
  return [
    'array', 'null', 'regexp', 'date', 'map', 'set', 'weakmap', 'weakset',
    'error', 'proxy', 'promise', 'arraybuffer', 'iterator', 'generator',
  ].includes(realType)
    ? realType
    : '';
};

const getType = (val: any): TypeInfo => ({
  type: typeof val,
  subtype: getSubType(val),
});

const getPreview = (val: any, others: ObjectFormatOptions = {}): ObjectPreview => {
  const { length = 5, origin = val } = others;

  const keys = Object.keys(val);
  const properties: PreviewProperty[] = [];
  keys.slice(0, length).forEach((key) => {
    let subVal: any;
    try {
      subVal = origin[key];
    } catch { }

    const { type, subtype } = getType(subVal);
    if (type === 'object') {
      if (subtype === 'array') {
        subVal = `Array(${subVal.length})`;
      } else if (subtype === 'null') {
        subVal = 'null';
      } else if (['date', 'regexp'].includes(subtype)) {
        subVal = subVal.toString();
      } else if (subtype === 'node') {
        subVal = `#${subVal.nodeName}`;
      } else {
        subVal = subVal.constructor.name;
      }
    } else {
      subVal = subVal === undefined ? 'undefined' : subVal.toString();
    }
    properties.push({
      name: key,
      type,
      subtype,
      value: subVal,
    });
  });

  return {
    overflow: keys.length > length,
    properties,
  };
};

export function objectFormat(val: any, others: ObjectFormatOptions = {}): RemoteObject {
  const { origin = val, preview = false } = others;

  const { type, subtype } = getType(val);

  if (type === 'undefined') return { type };

  if (type === 'number') return { type, value: val, description: val.toString() };

  if (type === 'string' || type === 'boolean') return { type, value: val };

  if (type === 'symbol') {
    return {
      type,
      objectId: getIdByObject(val, origin),
      description: val.toString(),
    };
  }

  if (subtype === 'null') return { type, subtype, value: val };

  const res: RemoteObject = { type, subtype, objectId: getIdByObject(val, origin) };

  if (type === 'function') {
    res.className = 'Function';
    res.description = val.toString();
    if (preview) {
      res.preview = {
        type,
        subtype,
        description: val.toString(),
        ...getPreview(val, { origin }),
      };
    }
  } else if (subtype === 'array') {
    res.className = 'Array';
    res.description = `Array(${val.length})`;
    if (preview) {
      res.preview = {
        type,
        subtype,
        description: `Array(${val.length})`,
        ...getPreview(val, { length: 100, origin }),
      };
    }
  } else if (subtype === 'error') {
    res.className = 'Error';
    res.description = val.stack;
    if (preview) {
      res.preview = {
        type,
        subtype,
        description: val.stack,
        ...getPreview(val, { origin }),
      };
    }
  } else if (subtype === 'node') {
    res.className = res.description = val.constructor.name;
  } else {
    try {
      res.className = res.description = val.constructor.name;
    } catch {
      res.className = res.description = '';
    }
    if (preview) {
      res.preview = {
        type,
        subtype,
        description: res.description || '',
        ...getPreview(val, { origin }),
      };
    }
  }

  return res;
}

// Get object properties, the level can be infinitely deep
export function getObjectProperties(params: GetPropertiesParams): PropertyDescriptor[] {
  const { accessorPropertiesOnly, generatePreview, objectId, ownProperties } = params;
  const curObject = objects.get(objectId);
  const origin = origins.get(objectId);
  const result: PropertyDescriptor[] = [];
  // eslint-disable-next-line no-proto
  const proto = (curObject as any).__proto__;

  const nextObject = proto && !ownProperties ? proto : curObject;

  const keys = Object.getOwnPropertyNames(nextObject);

  for (const key of keys) {
    if (key === '__proto__') continue;
    const property: PropertyDescriptor = { name: key } as PropertyDescriptor;

    let propVal: any;
    try {
      propVal = (origin as any)?.[key];
    } catch {
      // nothing to do
    }

    const descriptor = Object.getOwnPropertyDescriptor(nextObject, key)!;

    if (accessorPropertiesOnly && !descriptor.get && !descriptor.set) continue;

    property.configurable = descriptor.configurable || false;
    property.enumerable = descriptor.enumerable || false;
    property.writable = descriptor.writable || false;
    // eslint-disable-next-line no-prototype-builtins
    property.isOwn = ownProperties ? true : proto && proto.hasOwnProperty(key);
    property.value = objectFormat(propVal, { preview: generatePreview });

    result.push(property);
  }

  // Append __proto__ prototype
  if (proto) {
    result.push({
      name: '__proto__',
      configurable: true,
      enumerable: false,
      isOwn: !!ownProperties,
      value: objectFormat(proto, { origin }),
    } as PropertyDescriptor);
  }

  return result;
}

// release object
export function objectRelease({ objectId }: { objectId: string }): void {
  const object = objects.get(objectId);
  objects.delete(objectId);
  objectIds.delete(object!);
  origins.delete(objectId);
}

export function getObjectById(objectId: string): any {
  return objects.get(objectId);
}
