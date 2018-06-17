import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

export function takeValue(observable: Observable<any>): any {
    let result;
    if (observable) {
        observable.pipe(take(1)).subscribe(v => result = v);
    }
    return result;
}
export function isDefined(obj: any): boolean {
    return obj !== undefined && obj !== null;
}

export function noop() {}
export const isBrowser = typeof window !== 'undefined';
const nextFrame = (typeof setImmediate !== 'undefined') ? setImmediate
                        : (isBrowser && window.requestAnimationFrame) ? window.requestAnimationFrame.bind(window)
                        : (isBrowser && window.webkitRequestAnimationFrame) ? window.webkitRequestAnimationFrame.bind(window)
                        : setTimeout;
const cancelFrame = (typeof clearImmediate !== 'undefined') ? clearImmediate
                        : (isBrowser && window.cancelAnimationFrame) ? window.cancelAnimationFrame.bind(window)
                        : (isBrowser && window.webkitCancelAnimationFrame) ? window.webkitCancelAnimationFrame.bind(window)
                        : clearTimeout;
const ChangeObserver = isBrowser ? (window['MutationObserver'] || window['WebKitMutationObserver ']) : null;

let callbacks = {};
function invokeCallbacks() {
    pending = false;
    const copy = {
        ...callbacks
    };
    callbacks = {};
    for (const key in copy) {
        if (copy.hasOwnProperty(key)) {
            copy[key]();
        }
    }
}
let idCounter = 1;
let pending = false;
const observer = new ChangeObserver(invokeCallbacks);
const textNode = document.createTextNode(String(idCounter));
observer.observe(textNode, {
    characterData: true
});
export function callLater(fn: Function): number {
    if (!fn) {
        return undefined;
    }
    if (!ChangeObserver || !nextFrame) {
        fn();
        return undefined;
    }
    idCounter += 1;
    callbacks[idCounter] = fn;
    if (!pending) {
        pending = true;
        if (ChangeObserver) {
            // MutationObserver
            textNode.data = String((idCounter + 1) % 2);
        }
        if (nextFrame) {
            // requestAnimationFrame or setTimeout
            nextFrame(invokeCallbacks);
        }
    }
    return idCounter;
}
export function cancelCallLater(id: number) {
    if (isDefined(id)) {
        delete callbacks[id];
    }
}

export function moveItemTo(array: any[], item: any, index: number) {
    if (array && index >= 0 && index < array.length) {
        let from = array.indexOf(item);
        if (from !== -1) {
            const sep = (from < index) ? 1 : -1;
            while (from !== index) {
                array[from] = array[from + sep];
                array[from + sep] = item;
                from += sep;
            }
        }
    }
}
