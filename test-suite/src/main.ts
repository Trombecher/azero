import "./main.css";
import {html, map} from "../../index";
import {Observable, ObservableArray, reduce} from "../../observable";

function Card({children}: {children: Node[]}) {
    return html`
        <div class="p-4 border border-gray-200 rounded-lg">
            ${children}
        </div>
    `;
}

function SingleElement({children, no}: {children: Node[], no: number}) {
    return html`<div>no.: ${no} ${children}</div>`[1];
}

document.querySelector("#app")!.append(...html`
    <h1 class="text-xl">Syntax Tests</h1>
`);

document.querySelector("#app")!.append(...html`
    <div>Attribute test (yellow)</div>
    <div class="w-8 h-8 bg-yellow-400 flex-shrink-0"></div>
`);

document.querySelector("#app")!.append(...html`
    <div>Inline tag test (div):</div>
    <div class="h-[1px] w-full bg-gray-200"/>
`);

document.querySelector("#app")!.append(...html`
    <h1 class="text-xl">Template Tests</h1>
    <div>
        Insertion test: Inserted primitives
        ${"string"},
        ${200},
        ${true},
        ${document.createElement("span")} (a ${"<span></span>"}),
        ${document.createTextNode("a text node")},
        ${[document.createTextNode("text"), document.createElement("span")]}
        ([text, ${"<span></span>"}])
    </div>
`);

document.querySelector("#app")!.append(...html`
    <div>Component test (Card):</div>
    <${Card}>
        some child content
        <div class="bg-gray-200">Multiple children</div>
    </${Card}>
    <${Card}>
        another card
    </${Card}>
`);

document.querySelector("#app")!.append(...html`
    <div>Component test #2 (SingleElement) that returns a single Node + params (no="test"):</div>
    <${SingleElement} no="test">
        some child content
    </${SingleElement}>
`);

type ObservablePost = {
    title: Observable<string>,
    posted: Date,
    content: Observable<string>
}

type PostData = {
    title: string,
    posted: Date,
    content: string
}

const counter = new Observable(0);
const posts: ObservableArray<ObservablePost> = new ObservableArray();

document.querySelector("#app")!.append(...html`
    <h1 class="text-xl">State Tests</h1>
`);

document.querySelector("#app")!.append(...html`
    <div>Observable integration test (primitive)</div>
    <button
        onclick=${() => counter.value++}
        class="px-4 py-2 bg-gray-100 font-semibold select-none
        rounded-full border border-gray-200 hover:border-gray-500 transition"
    >
        Reactive test: ${counter}
    </button>
    <div>
        Derive test (is ${counter} even?):
        ${counter.derive(count => count % 2 === 0 ? "yes" : "no")}
    </div>
`);

document.querySelector("#app")!.append(...html`
    <div>Observable integration test static array (derived from primitive) [re-rendered on change]:</div>
    <div>
        ${counter.derive(count => new Array(count)
            .fill(0)
            .map((_, i) => html`
                <div>reverse: ${count - i}</div>
            `[1]))}
    </div>
`);

function transform(): PostData[] {
    return posts.map(post => ({
        title: post.title.value,
        content: post.content.value,
        posted: post.posted
    }));
}

const transformed = new Observable(transform());

function reTransform() {
    transformed.value = transform();
}

posts.subscribeToInsert(reTransform);
posts.subscribeToMove(reTransform);
posts.subscribeToRemoveAt(reTransform);
posts.subscribeToSet(reTransform);

document.querySelector("#app")!.append(...html`
    <div>ObservableArray integration test with posts (map function):</div>
    <button class="bg-gray-200 rounded-full" onclick=${() => {
        posts.add({
            title: new Observable("Example Post"),
            posted: new Date(),
            content: new Observable("Some example content"),
        });
    }}>Add default post</button>
    ${map(posts, post => html`
        <div class="p-4 rounded-lg border border-gray-200">
            <div class="gap-4 items-center flex pb-2 mb-2 border-b border-gray-200">
                <h2 title="click to edit" class="text-lg font-semibold inline select-none hover:bg-gray-200" onclick=${() => {
                    const ask = prompt("Enter new post title");
                    if(ask) post.title.value = ask;
                }}>${post.title}</h2>
                <div>posted ${post.posted}</div>
                <div onclick=${() => posts.remove(post)} class="ml-auto">Delete Post</div>
            </div>
            <div title="click to edit" class="select-none hover:bg-gray-200" onclick=${() => {
                const ask = prompt("Enter new post content");
                if(ask) post.content.value = ask;
            }}>${post.content}</div>
        </div>
    `[1])}
    <div>
        Subscribe test (serialization):
        ${transformed.derive(value => JSON.stringify(value))}
    </div>
`);

const multiplier = new Observable(0);

document.querySelector("#app")!.append(...html`
    <div>Reduce Test with counter (${counter}) and multiplier (${multiplier}):</div>
    <button class="bg-gray-200" onclick=${() => multiplier.value++}>
        increment multiplier
    </button>
    <div>${counter} * ${multiplier} = ${reduce([counter, multiplier], ([a, b]) => a * b)}</div>
`);