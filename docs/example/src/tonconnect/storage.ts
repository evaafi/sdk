import path from 'path';
import fs from 'fs/promises';

export interface Storage {
    /**
     * Saves the `value` to the storage. Value can be accessed later by the `key`. Implementation may use backend as a storage due to the fact that the function returns a promise.
     * @param key key to access to the value later.
     * @param value value to save.
     */
    setItem(key: string, value: string): Promise<void>;
    /**
     * Reads the `value` from the storage. Implementation may use backend as a storage due to the fact that the function returns a promise.
     * @param key key to access the value.
     */
    getItem(key: string): Promise<string | null>;
    /**
     * Removes the `value` from the storage. Implementation may use backend as a storage due to the fact that the function returns a promise.
     * @param key key to access the value.
     */
    removeItem(key: string): Promise<void>;
}

type StorageObject = {
    [k: string]: string;
};

export class FSStorage implements Storage {
    #path: string;

    constructor(path: string) {
        this.#path = path;
    }

    async #readObject(): Promise<StorageObject> {
        try {
            return JSON.parse((await fs.readFile(this.#path)).toString('utf-8'));
        } catch (e) {
            return {};
        }
    }

    async #writeObject(obj: StorageObject): Promise<void> {
        await fs.mkdir(path.dirname(this.#path), { recursive: true });
        await fs.writeFile(this.#path, JSON.stringify(obj));
    }

    async setItem(key: string, value: string): Promise<void> {
        const obj = await this.#readObject();
        obj[key] = value;
        await this.#writeObject(obj);
    }

    async getItem(key: string): Promise<string | null> {
        const obj = await this.#readObject();
        return obj[key] ?? null;
    }

    async removeItem(key: string): Promise<void> {
        const obj = await this.#readObject();
        delete obj[key];
        await this.#writeObject(obj);
    }
}