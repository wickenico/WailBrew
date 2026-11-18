import { Events } from "@wailsio/runtime";

/**
 * Subscribes to a backend event and passes its payload to the callback.
 * The Go side always emits zero or one value, which Wails v3 delivers as `event.data`.
 * Returns a function that removes the listener.
 */
export function onEvent<T = unknown>(name: string, callback: (data: T) => void): () => void {
    return Events.On(name, (event) => callback(event.data as T));
}
