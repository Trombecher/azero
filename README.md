# azero

![Showcase](images/showcase.png)

A lightweight front-end JavaScript framework with built-in state management. The syntax is similar to [htm](https://github.com/developit/htm) used with [vhtml](https://github.com/developit/vhtml). `azero` is more than just the syntax! It is the whole runtime transforming your syntax. **Without a Virtual Tree**.

## Table Of Contents

<!-- TOC -->
* [azero](#azero)
  * [Table Of Contents](#table-of-contents)
  * [Installation](#installation)
  * [JSX-Like Syntax](#jsx-like-syntax)
  * [Inserting](#inserting)
    * [Inserting Values](#inserting-values)
    * [Inserting Nodes](#inserting-nodes)
    * [Inserting Observable Values](#inserting-observable-values)
    * [Inserting Observable Nodes](#inserting-observable-nodes)
  * [Attributes](#attributes)
    * [Attributes on Components](#attributes-on-components)
    * [Inserting Values and Observables](#inserting-values-and-observables)
    * [Inserting Values and Observables Into Strings](#inserting-values-and-observables-into-strings)
    * [Spread Props](#spread-props)
  * [Components](#components)
  * [State Management](#state-management)
    * [Observable](#observable)
      * [Changing the value](#changing-the-value)
      * [Subscribing](#subscribing)
      * [Deriving](#deriving)
      * [Mutable Data](#mutable-data)
    * [ObservableArray](#observablearray)
      * [Atomic Operations](#atomic-operations)
      * [Subscribing](#subscribing-1)
      * [Map](#map)
    * [Reduce](#reduce)
  * [Lifecycle](#lifecycle)
    * [Automatic Lifecycle](#automatic-lifecycle)
<!-- TOC -->

## Installation

The use of [Vite](https://vitejs.dev/guide/) with `vanilla-ts` (TypeScript template) and [TailwindCSS](https://tailwindcss.com/docs/guides/vite) is strongly recommended.

```shell
npm i azero

pnpm i azero
```

After that, update your dependencies.

```shell
npm update

pnpm up
```

## JSX-Like Syntax

`azero` uses JSX-like syntax like `htm` does. This is powered by [tagged templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) and works in any modern browser. This is the counter example shown in every modern framework in `azero`:

```ts
const counter = new Observable(0);

document.body.append(...html`
    <div class="flex w-screen h-screen justify-center items-center text-gray-600 bg-white">
        <button
            onclick=${() => counter.value++}
            class="px-4 py-2 bg-gray-100 font-semibold
            rounded-full border border-gray-200 hover:border-gray-500 transition"
        >
            You have clicked me ${counter}
            ${counter.derive(count => count === 1 ? "time" : "times")}
        </button>
    </div>
`);
```

After this README you will be able to understand and fully recreate the example above.

## Inserting

### Inserting Values

You can insert any value into the dom; it will be converted to a string:

```ts
const x = 23;

document.body.append(...html`
    <div>${"a string"}</div>
    <div>${true}</div>
    <div>${x}</div>
`);
```

### Inserting Nodes

You can also insert types `Node` and `Node[]`:

```ts
const myNodes = html`
    <div>Foo</div>
    <div>Bar</div>
`;

document.body.append(...html`
    <div>${myNodes}</div>
`);
```

### Inserting Observable Values

You can insert observable values easily:

```ts
const counter = new Observable(0);

document.body.append(...html`
    <button onclick=${() => counter.value++}>You have clicked me ${counter} times</button>
`);
```

### Inserting Observable Nodes

You can also insert types `Observable<Node>` and `Observable<Node[]>`. Because this is rarely done there is not a recommended use case example. Furthermore, when using `Observable<Node>` it is required that the _initial value_ of the `Observable` is of type `Node` and **not** `null` or `undefined`. That is due to the runtime _exchanging_ the nodes. If you want such a functionality nonetheless, you could **toggle a `hidden` class on the element** or use an `Observable<Node[]>` where - _initially_ - you assign an **empty array** and then - when you update - assign a **new** array containing your **new** node.

> Read more about using `Observable` with **mutable data** under [Mutable Data](#mutable-data)

## Attributes

`azero` supports a rich attribute syntax:

```ts
document.body.append(...html`
    <div title="Foo">Bar</div>
    <div title='Foo'>Bar</div>
    <div title=Foo>Bar</div> <!-- not recommended -->
`);
```

Internally the attribute is setting the property of the node (key) to the given value. `class` keys are automatically converted to `className`. Here is an example:

```ts
document.body.append(...html`
    <div title="Foo">Bar</div>
`);

// azero (index.js)

// ...

const node = document.createElement("div");
node["title"] = "Bar";

// ...
```

### Attributes on Components

Attributes on components are collected on an object that will be given to the function at invocation. The property children will contain an array of child nodes.

```ts
function MyComponent({something, children}: {something: number, children: Node[]}) {
    return html`
        <div>
            something: ${something}
            ${children}
        </div>
    `;
}

document.body.append(...html`
    <${MyComponent} title="Foo">Bar<//>
`);
```

> [How to use components](#components)

> [Inserting nodes](#inserting-nodes)

### Inserting Values and Observables

You can also insert values and observables as attributes:

```ts
const x = "Hello";
const toggledClass = new Observable("hidden");

// ... update `toggledClass` ...

document.body.append(...html`
    <div title=${"Foo"}>Bar</div>
    <div title=${x}>Zen</div>
    <div class="${toggledClass}">Zen</div> <!-- the same effect -->
    <div class='${toggledClass}'>Zen</div> <!-- the same effect -->
    <div class=${toggledClass}>Zen</div> <!-- the same effect -->
`);
```

If an `Observable` is inserted, it auto-subscribes to that `Observable` and sets the attribute on update.

### Inserting Values and Observables Into Strings

You can also insert values and observables into attribute strings:

```ts
const myStaticClass = "foo";
const toggledClass = new Observable("hidden");

// ... update `toggledClass` ...

document.body.append(...html`
    <div class="bg-indigo-600 ${toggledClass} ${myStaticClass} etc...">Bar</div> <!-- the same effect -->
    <div class='bg-indigo-600 ${toggledClass} ${myStaticClass} etc...'>Bar</div> <!-- the same effect -->
`);
```

This is implemented using [the `reduce` function](#reduce).

### Spread Props

Spread props are similar to JSX. All properties of the specified object are assigned to the element / component props.

```ts
document.body.append(...html`
    <div ...${{title: "Foo"}}>Bar</div>
`);
```

## Components

Components are - similar to React - functions returning reusable UI and logic. If the function is being used as a component, it may only return types `Node` and `Node[]`.

```ts
function Component({children}: {children: Node[]}) {
    return html`
        <div title="Foo">
            Bar
            ${children}
        </div>
    `;
}
```

`azero` gives you many ways to insert a component.

```ts
document.body.append(...html`
    <${Component}/>
    <${Component}>Children</${Component}>
    <${Component}>Children<//>
    ${Component({children: []})} <!-- not recommended -->
    ${Component({children: [document.createTextNode("Children")]})} <!-- not recommended -->
`);
```

## State Management

`azero` gives you excellent built-in support for state management. The module `azero/observable` contains those classes:

- `Observable<T>`
- `ObservableArray<E>`
- `ObservableMap<T>`

> Note: This module can be used without using azero core.

### Observable

> This concept is similar to React `useState()` and Svelte `Store`.

`Observable<T>` is a wrapper for a generic value `T`; primarily used with **primitives**. You can create an `Observable` with:

```ts
const observable = new Observable(0);
```

The type (in this case `number`) will be inferred by TypeScript.

#### Changing the value

You can get / set the value through the ES6 class getter / setter property `Observable.value`:

```ts
observable.value = 23; // set
console.log(observable.value); // get
```

#### Subscribing

This is where the magic happens. You can call `subscribe` on `observable` and the callback function provided is called whenever the _value changes_. This also returns another function, that _unsubscribes the subscriber_ (when called).

```ts
const unsubscribe = observable.subscribe(value => console.log(value), false);
observable.value = 20; // logs `20`

// later
unsubscribe();
```

When initially subscribing, the second parameter (assigned to `false` in the example) is a boolean specifying whether **the callback should be called when initially subscribing**. This parameter will default to `true`. This is especially useful if you are synchronizing data and want to set an initial value to your target. In other words: if you were to remove that `false` in the invocation, it would log `20` _on the subscribe line_.

#### Deriving

The `Observable.derive` function creates a **new** `Observable` that can be derived / generated / produced from the current:

```ts
const message = new Observable("Hello!");
const messageInUppercase = message.derive(message => message.toUpperCase());
```

Whenever `message` updates, `messageInUppercase` updates too and will contain the uppercase version of the message. Another frequent use case is toggled content:

```ts
const hidden = new Observable(false);

document.body.append(...html`
    <button onclick=${() => hidden.value = !hidden.value}>Toggle</button>
    <div class="${hidden.derive(hidden => hidden ? "hidden" : "")} bg-blue-600 ...">Some content</div>
`);
```

The string is derived from the boolean and inserted into the attribute.

#### Mutable Data

The use of `Observable`s with objects and arrays for reactivity is discouraged, because - internally - it compares the assigned value and the existing value with `===`. So when the same object is present, `===` does not care if it was modified, **it has to be a different object**. But it has great application for static content:

```ts
const split: Observable<string[]> = new Observable([]);
let input = "";

document.body.append(...html`
    <input oninput=${(e: Event) => input = (e.target as HTMLInputElement).value}>
    <button onclick=${() => split.value = input.split("")}>Split!</button>
    ${split.derive(split => split.map(char => html`
        <div>Char: ${char}</div>
    `[1]))}
`);
```

In the example the `split` `Observable<string[]>` is derived from the user input (not directly, but when the user presses the button, the split string is assigned to `split`). Now whenever `split` updates, the `split` array (in the provided arrow function) is mapped to an array of nodes. Note, that because `html` returns `Node[]` and you are mapping `string` to `Node` not `Node[]`, the trailing `[1]` **must be added**. This captures the `<div/>`. **Even if there is no whitespace before the `<div/>`, there is always a text node**. If you did not capture the index 1 of the array, `Observable<string[]>` would be mapped to `Observable<Node[][]>` (which the runtime cannot resolve).

> Note, that those nodes will **always** be **re-rendered** when `split` changes. Also, it relies on the creation of new objects. If you still want a reactive array, check out the next section.

### ObservableArray

The `ObservableArray<E>` is a wrapper around an array of `E`. It has a completely different set of functions than `Array`.

```ts
const numbers = new ObservableArray([10, 20]); // You can provide an initializer array
numbers.add(30);
numbers.remove(10);
// ...
```

In case you did not provide an initializer array you will need to annotate the type, because TypeScript will not be able to infer the type:

```ts
const numbers = new ObservableArray<number>();
// ...
```

#### Atomic Operations

**Any** operation done by its interface comes down to those four atomic operations:

- `set(index: number, element: E)`: Sets the index to the element (overriding / replacing)
- `insert(index: number, element: E)`: Inserts the element at the specified index
- `removeAt(index: number)`: Removes the element at the specified index
- `move(from: number, to: number)`: Moves the element at index `from` to index `to`

#### Subscribing

You can subscribe to any of those operations and therefore are able to _mirror_ the `ObservableArray` on your own array:

- `subscribeToSet(subscription: (index: number, element: E) => void): () => void`
- `subscribeToInsert(subscription: (index: number, element: E) => void): () => void`
- `subscribeToRemoveAt(subscription: (index: number, element: E) => void): () => void`
- `subscribeToMove(subscription: (from: number, to: number) => void): () => void`

All of those functions return a function that - when called - unsubscribes your subscription.

#### Map

The `map` functions provides a way to integrate your `ObservableArray` into the dom:

`map<E>(array: ObservableArray<E>, mapper: (element: E, index: number) => Node): Node[]`

It maps each element to a node, so you can easily integrate your data. Internally, it subscribes to all atomic operations and therefore mirrors changes to the `array` with the dom. When nodes are added / removed, only new nodes are rendered. An example:

```ts
type Post = {
  title: string,
  content: string
}

const posts = new ObservableArray<Post>([
    {
        title: "Initial Post",
        content: "Initial Content"
    }
]);

document.body.append(...html`
    <button onclick=${() => posts.add({
        title: "A Post",
        content: "Lorem Ipsum"
    })}>Add Post</button>
    ${map(posts, post => html`
        <div>
            <h1>
                ${post.title} -
                <button onclick=${() => posts.remove(post)}>Delete Post</button>
            </h1>
            <div>${post.content}</div>
        </div>
    `[1])}
`);
```

Here the `posts` `ObservableArray` contains an initial post. New posts are added through `posts.add({...})`. Each post maps to a visual representation of the post data, including a button that uses `posts.remove(post)` to remove the post. Simple.

### Reduce

> This section technically belongs to `Observable`.

> This concept is similar to the Svelte `$: ...` syntax.

The `reduce` function combines an array of `Observable`s into one **new** `Observable` which can be derived / generated / produced from all the specified ones. This function could have easily been called _derive_ but in a sense it is similar to the _reduce_ operation on an array, so `reduce` was kept. A frequent use case is:

```ts
const a = new Observable(0);
const b = new Observable(0);

document.body.append(...html`
    <div>${a} * ${b} = ${reduce([a, b], ([a, b]) => a * b)}</div>
`);
```

The result of `a * b` is dependent on both `Observable`s `a` **and** `b`. When each of them changes, the reducer (function) will be called to recalculate the result.

Note, that types are not available in `reduce` because `reduce` accepts variable type parameters.

## Lifecycle

Components (normally) have this lifecycle:

`Mounting` -> `Updating` -> `Unmounting`

Because nodes and components in `azero` are updated on node-level, the `Updating` step is negligible for the component. Both `Mounting` and `Unmounting` happen on node-level too. `azero` gives you two optional properties

- `Node.onMount: () => void`
- `Node.onUnmount: () => void`

on _every_ node, that will be called when this node is added / removed from the dom.

### Automatic Lifecycle

When inserting an `Observable`, `azero` will _subscribe_ on mount and _unsubscribe_ on unmount, so that this node is not updated when it isn't being used. Example (a clock):

```ts
const time = new Observable(new Date());
let interval: number;

document.body.append(...html`
    <div
        onMount=${() => interval = setInterval(() => time.value = new Date(), 1000)}
        onUnmount=${() => clearInterval(interval)}
    >
        Time: ${time}
    </div>
`);
```

---

**You're done! Start making some apps!**