export class ObservableArray<E> implements Iterable<E> {
    readonly #data: E[];

    constructor(init?: E[]) {
        this.#data = init ? init : [];
    }

    [Symbol.iterator]() {
        return this.#data.values();
    }

    /**
     * Equivalent to the `reduce` implementation of `Array`.
     */
    reduce<R>(reducer: (accumulator: R, element: E, index: number) => R, initialValue: R) {
        for(let i = 0; i < this.#data.length; i++)
            initialValue = reducer(initialValue, this.#data[i] as E, i);
        return initialValue;
    }

    /**
     * Equivalent to the `map` implementation of `Array`.
     */
    map<R>(mapper: (element: E, index: number) => R): R[] {
        const map: R[] = [];
        for(let i = 0; i < this.#data.length; i++)
            map.push(mapper(this.#data[i] as E, i));
        return map;
    }

    /**
     * The length of the array.
     */
    get length() {
        return this.#data.length;
    }

    /**
     * Adds the element to the end of the array.
     */
    add(element: E): void {
        this.set(this.#data.length, element);
    }

    /**
     * Inserts the element at the specified index.
     *
     * If `index >= length`, index is clamped to length (this has the same effect as adding the element).
     * A negative index is mapped to `length + index` (if `length + index < 0`, index is clamped to `0`).
     *
     * Note, that this does **not** replace the previous element
     * (for that functionality, use `set`) but shifts all indexes above one higher.
     */
    insert(index: number, element: E) {
        if(index > this.#data.length) index = this.#data.length;
        else if(index < 0) index = Math.max(0, this.#data.length + index);

        this.#data.splice(index, 0, element);
        for(const notify of this.#onInsert)
            notify(index, element);
    }

    /**
     * Adds all elements of the specified iterator to the end of the array.
     */
    addAll(elements: Iterable<E>): void {
        for(const element of elements) this.add(element);
    }

    entries(): IterableIterator<[number, E]> {
        return this.#data.entries();
    }

    /**
     * @returns `true` if every element in the array passes the test.
     */
    every(predicate: (value: E, index: number) => unknown): boolean {
        return this.#data.every(predicate);
    }

    /**
     * Set all values in the given range (start index included, end index not included) to a given value.
     */
    fill(value: E, start?: number, end?: number): this {
        this.#data.fill(value, start, end);
        for(let i = start ? start : 0; i < (end ? end : this.#data.length) - 1; i++)
            for(const notify of this.#onSet)
                notify(i, this.get(i) as E);
        return this;
    }

    /**
     * Removes the element(s) for which the predicate returns `true`.
     */
    removeIf(predicate: (value: E, index: number) => boolean): void {
        let i = this.length;
        while(i--)
            if(predicate(this.#data[i] as E, i))
                this.removeAt(i);
    }

    /**
     * @returns A **new** array of all elements removed from the current array by their predicate returning `true`.
     */
    extractIf(predicate: (value: E, index: number) => unknown): E[] {
        const collect: E[] = [];

        let i = this.length;
        while(i--)
            if(predicate(this.#data[i] as E, i))
                collect.push(this.extractAt(i)!);

        return collect;
    }

    /**
     * Get the element at the specified index.
     * A negative index will be mapped to `length + index`.
     * If the index is out of bounds, `undefined` will be returned.
     */
    get(index: number): E | undefined {
        return this.#data.at(index);
    }

    #onRemoveAt: ((index: number, element: E) => void)[] = [];

    /**
     * Subscribes to remove events.
     * @returns An function that unsubscribes.
     */
    subscribeToRemoveAt(subscription: (index: number, element: E) => void): () => void {
        this.#onRemoveAt.push(subscription);
        return () => this.#onRemoveAt.splice(this.#onSet.indexOf(subscription), 1);
    }

    /**
     * Removes the specified element from the array.
     *
     * @returns `true` if the element was found, else `false`.
     */
    remove(element: E): boolean {
        const index = this.#data.indexOf(element);
        if(index === -1) return false;
        this.removeAt(index);
        return true;
    }

    /**
     * Removes the element at the specified index.
     *
     * If `index >= length`, nothing will be done.
     * A negative index will be mapped to `length + index` (if `length + index < 0`, the index will be clamped to `0`).
     */
    removeAt(index: number) {
        if(index > this.#data.length) return;
        else if(index < 0) index = Math.max(0, this.#data.length + index);
        const element = this.#data.splice(index, 1)[0] as E;
        for(const notify of this.#onRemoveAt)
            notify(index, element);
    }

    /**
     * Extracts the element from the specified index.
     * 
     * If `index >= length`, it returns undefined;
     * A negative index will be mapped to `length + index` (if `length + index < 0`, the index will be clamped to `0`).
     */
    extractAt(index: number): E | undefined {
        if(index > this.#data.length) return undefined;
        else if(index < 0) index = Math.max(0, this.#data.length + index);

        const element = this.#data.splice(index, 1)[0] as E;
        for(const notify of this.#onRemoveAt)
            notify(index, element);
        return element;
    }

    readonly #onSet: ((index: number, element: E) => void)[] = [];

    readonly #onInsert: ((index: number, element: E) => void)[] = [];

    readonly #onMove: ((from: number, to: number) => void)[] = [];

    /**
     * Subscribes to move events.
     * @returns A function that unsubscribes.
     */
    subscribeToMove(subscription: (from: number, to: number) => void): () => void {
        this.#onMove.push(subscription);
        return () => {
            const index = this.#onMove.indexOf(subscription);
            if(index !== -1) this.#onMove.splice(index, 1);
        };
    }

    /**
     * Subscribes to insert events.
     * @returns A function that unsubscribes.
     */
    subscribeToInsert(subscription: (index: number, element: E) => void): () => void {
        this.#onInsert.push(subscription);
        return () => {
            const index = this.#onInsert.indexOf(subscription);
            if(index !== -1) this.#onInsert.splice(index, 1);
        };
    }

    /**
     * Subscribes to set events.
     * @returns A function that unsubscribes.
     */
    subscribeToSet(subscription: (index: number, element: E) => void): () => void {
        this.#onSet.push(subscription);
        return () => {
            const index = this.#onSet.indexOf(subscription);
            if(index !== -1) this.#onSet.splice(index, 1);
        };
    }

    /**
     * Moves the item at element _from_ to index _to_.
     *
     * @param from Indexes `0` to `length - 1`. A negative value `n` maps to `length + n`;
     * @param to Indexes `0` to `length - 1`. A negative value `n` maps to `length + n`;
     */
    move(from: number, to: number) {
        this.#data.splice(to, 0, this.#data.splice(from, 1)[0]!);
        for(const notify of this.#onMove) notify(from, to);
    }

    /**
     * Sets the index to the specified element.
     *
     * If `index > length` it does nothing.
     * Note, that the index `length` is included in order to append items.
     */
    set(index: number, element: E): void {
        if(index > this.#data.length) return;
        this.#data[index] = element;
        for(const notify of this.#onSet) notify(index, element);
    }

    /**
     * Removes all elements from the array.
     * Note, that all elements are removed **before** notifying the subscribers.
     */
    clear() {
        const removed = this.#data.splice(0, this.#data.length);
        for(let i = 0; i < removed.length; i++)
            for(const notify of this.#onRemoveAt)
                notify(i, removed[i]!);
    }

    /**
     * Equivalent to the `includes` implementation of `Array`.
     */
    includes(element: E): boolean {
        return this.#data.includes(element);
    }

    /**
     * @returns `true` if all specified elements are included in the array, else `false`.
     */
    includesAll(elements: Iterable<E>): boolean {
        main: for(const e1 of elements) {
            for(const e2 of this)
                if(e1 === e2)
                    continue main;
            return false;
        }
        return true;
    }

    /**
     * @returns The first element for which the predicate returns `true`.
     * If no element matches the predicate, `undefined` will be returned.
     */
    first(predicate: (element: E, index: number) => boolean): E | undefined {
        for(let i = 0; i < this.#data.length; i++) {
            const element = this.#data[i]!;
            if(predicate(element, i))
                return element;
        }

        return undefined;
    }

    /**
     * Equivalent to the `indexOf` implementation of `Array`.
     */
    indexOf(element: E, from: number): number {
        return this.#data.indexOf(element, from);
    }

    /**
     * @returns `true` if the length is 0, else `false`.
     */
    isEmpty(): boolean {
        return this.#data.length === 0;
    }

    /**
     * @returns The nth index of the specified element.
     */
    nthIndexOf(element: E, n: number): number {
        let index = -1;

        for(const e of this) {
            if(element === e) {
                index++;
                if(index === n) return index;
            }
        }

        return index;
    }

    /**
     * @returns The last index of the specified element.
     */
    lastIndexOf(element: E): number {
        return this.#data.lastIndexOf(element);
    }

    /**
     * Removes all elements that specified and included in the array.
     *
     * @returns `true` if the array was modified, else `false`.
     */
    removeAll(elements: Iterable<E>): boolean {
        let modified = false;
        for(const element of elements) {
            const index = this.#data.indexOf(element);
            if(index !== -1) {
                modified = true;
                this.removeAt(index);
            }
        }
        return modified;
    }

    /**
     * @returns A **new** array containing all elements in the range (toIndex excluded).
     */
    subArray(fromIndex: number, toIndex: number): E[] {
        const range: E[] = [];
        if(fromIndex < 0) fromIndex = Math.max(0, this.#data.length + fromIndex);
        if(toIndex < 0) toIndex = Math.max(0, this.#data.length + toIndex);
        for(let i = Math.max(fromIndex, 0); i < Math.min(this.#data.length, toIndex); i++)
            range.push(this.#data[i]!);
        return range;
    }

    /**
     * @returns The underlying array. **Use with caution, as the subscribers will not be notified of modifications!**
     */
    toArray() {
        return this.#data;
    }
}

/**
 * This is an observable store designed for immutable data.
 * When storing mutable arrays or maps (objects), consider using **ObservableArray** or **ObservableMap**.
 */
export class Observable<T> {
    #value: T;
    readonly #subscriptions: ((value: T) => void)[] = [];

    constructor(initialValue: T) {
        this.#value = initialValue;
    }

    set value(value: T) {
        if(this.#value === value) return;
        this.#value = value;
        for(const notify of this.#subscriptions)
            notify(value);
    }

    get value() {
        return this.#value;
    }

    /**
     * @param subscription The function called when this value changes.
     * @param init If true, the function is called when initially subscribing.
     *
     * @returns A function that unsubscribes.
     */
    subscribe(subscription: (value: T) => void, init: boolean = true): () => void {
        if(init) subscription(this.value);
        this.#subscriptions.push(subscription);
        return () => this.#subscriptions.splice(this.#subscriptions.indexOf(subscription), 1);
    }

    /**
     * Creates a **new** observable value that is derived from the current observable value.
     * Changes are automatically forwarded.
     */
    derive<N>(produce: (value: T) => N): Observable<N> {
        const observable = new Observable(produce(this.value));
        this.subscribe(value => observable.value = produce(value), false);
        return observable;
    }
}

/**
 * Merges an array of observable values into one observable value that updates
 * whenever any of the provided observable values update.
 * If you just want to reduce one observable value, use `Observable.derive`.
 * The array given to the reducer will be reused between updates.
 */
export function reduce<N>(dependencies: Observable<any>[], reducer: (values: any[]) => N): Observable<N> {
    const values: any[] = new Array(dependencies.length);
    for(let i = 0; i < dependencies.length; i++) {
        const dependency = dependencies[i]!;
        values[i] = dependency.value;
        dependency.subscribe(value => {
            values[i] = value;
            reduced.value = reducer(values);
        }, false);
    }
    const reduced = new Observable(reducer(values));
    return reduced;
}

export class ObservableMap<K, V> extends Map<K, V> {
    #onDelete: ((key: K) => void)[] = [];

    subscribeToDelete(subscription: (key: K) => void): () => void {
        this.#onDelete.push(subscription);
        return () => {
            const index = this.#onDelete.indexOf(subscription);
            if(index === -1) return;
            this.#onDelete.splice(index, 1);
        };
    }

    #onSet: ((key: K, value: V) => void)[] = [];

    subscribeToSet(subscription: (key: K, value: V) => void): () => void {
        this.#onSet.push(subscription);
        return () => {
            const index = this.#onSet.indexOf(subscription);
            if(index === -1) return;
            this.#onSet.splice(index, 1);
        };
    }

    override set(key: K, value: V): this {
        if(#onSet in this)
            for(const dispatch of this.#onSet)
                dispatch(key, value);
        super.set(key, value);
        return this;
    }

    override delete(key: K): boolean {
        for(const dispatch of this.#onDelete)
            dispatch(key);
        return super.delete(key);
    }
}