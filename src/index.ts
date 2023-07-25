import {Observable, ObservableArray, reduce} from "./observable";

declare global {
    interface Node {
        onMount?: () => void
        onUnmount?: () => void
    }
}

const tags = /(<([a-zA-Z][a-zA-Z\-\d]*)([^\/"'>]|(("((\\")|[^"])*")|('((\\')|[^'])*')|([^\/"'>\s]+)))*\/?>)|(<\/(\/|([a-zA-Z][a-zA-Z\-\d]*))\s*>)/gm;
const attributes = /\s*([^\/"'>\s=]+)(\s*=\s*(("(((\\")|[^"])*)")|('(((\\')|[^'])*)')|([^\/"'>\s]+)))?/gm;

const voidTags = [
    "area",
    "base",
    "basefont",
    "bgsound",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "image",
    "img",
    "input",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
];

const observer = new MutationObserver(records => {
    for(const record of records) {
        for(const addedNode of record.addedNodes) {
            addedNode.onMount?.call(this);
            if(addedNode instanceof HTMLElement)
                addedNode.querySelectorAll("*").forEach(node =>
                    node.onMount?.call(this))
        }

        for(const removedNode of record.removedNodes) {
            removedNode.onUnmount?.call(this);
            if(removedNode instanceof HTMLElement)
                removedNode.querySelectorAll("*").forEach(node =>
                    node.onMount?.call(this))
        }
    }
});

observer.observe(document.body.parentElement!, {
    childList: true,
    subtree: true
});

export function html(strings: TemplateStringsArray, ...values: any[]): Node[] {
    const replacement = "a0";
    const molten = strings.join(replacement);

    let valueIndex = -1;

    function getValue() {
        valueIndex++;
        return values[valueIndex];
    }

    const parts: (RegExpMatchArray | string)[] = [];

    let lastI = 0;
    for(const match of molten.matchAll(tags)) {
        parts.push(molten.substring(lastI, match.index), match);
        lastI = match.index! + match[0].length;
    }

    parts.push(molten.substring(lastI));

    const partsIter = parts[Symbol.iterator]();

    function parse(textOrTag: RegExpMatchArray | string): Node | Node[] | string | Function {
        if(typeof textOrTag === "string") {
            const split = textOrTag.split("a0");
            const nodes: Node[] = [document.createTextNode(split[0]!)];
            for(let j = 1; j < split.length; j++) {
                const value = getValue();
                if(value instanceof Node) nodes.push(value);
                else if(value instanceof Array) nodes.push(...value);
                else if(value instanceof Observable) {
                    if(value.value instanceof Node) {
                        let previousNode = value.value;
                        value.subscribe(node => {
                            previousNode.parentElement!.replaceChild(node, previousNode);
                            previousNode = node;
                        });

                        nodes.push(previousNode);
                    } else if(value.value instanceof Array) {
                        const anchor = document.createTextNode("");
                        const oldNodes = [...value.value];
                        anchor.after(...oldNodes);

                        value.subscribe(nodes => {
                            for(let oldNode of oldNodes)
                                anchor.parentElement!.removeChild(oldNode);
                            oldNodes.splice(0, oldNodes.length);
                            oldNodes.push(...nodes);
                            anchor.after(...nodes);
                        }, false);

                        nodes.push(anchor, ...value.value);
                    } else {
                        const text = document.createTextNode("");
                        text.onMount = () =>
                            text.onUnmount = value.subscribe(value =>
                                text.textContent = value + "");

                        nodes.push(text);
                    }
                } else nodes.push(document.createTextNode(value));

                nodes.push(document.createTextNode(split[j]!));
            }

            return nodes;
        }

        if(textOrTag[2]) { // start tag
            if(textOrTag[2] === replacement) { // component
                const component = getValue();

                const params: {[index: string]: any} = {};

                const attributesString = textOrTag[0]
                    .substring(1 + textOrTag[2].length, textOrTag[0].length);
                for(const match of attributesString.matchAll(attributes)) {
                    const key = match[1]!;

                    if(key === "..." + replacement) { // spread props
                        Object.assign(params, getValue());
                        continue;
                    }

                    let value = match[9];
                    if(value === undefined) {
                        value = match[5];
                        if(value === undefined) value = match[3];
                    }

                    if(value === replacement)
                        params[key] = getValue();
                    else params[key] = value;
                }

                params["children"] = [];

                if(textOrTag[0].at(-2) === "/") // inline
                    return component(params);

                let end: Function | string;
                for(const part of partsIter) {
                    const children = parse(part);
                    if(children instanceof Array)
                        params["children"].push(...children);
                    else if(children instanceof Node)
                        params["children"].push(children);
                    else if(typeof children === "function" || typeof children === "string") {
                        end = children;
                        break;
                    } else throw new Error(`Unexpected value ${children}`);
                }

                // @ts-ignore
                if(component !== end && end !== "/")
                    throw new Error("Start and end tags of component do not match");

                return component(params);
            }

            // native
            const element: HTMLElement & {[index: string]: any} =
                document.createElement(textOrTag[2]);

            const attributesString = textOrTag[0]
                .substring(1 + textOrTag[2].length, textOrTag[0].length);
            for(const match of attributesString.matchAll(attributes)) {
                let key = match[1]!;

                if(key === "class") key = "className";
                else if(key === "..." + replacement) {
                    Object.assign(element, getValue());
                    continue;
                }

                let value = match[9];
                if(value === undefined) {
                    value = match[5];
                    if(value === undefined) value = match[3];
                }

                if(value === undefined)
                    element[key] = "";
                else if(value === replacement) {
                    const value = getValue();
                    if(value instanceof Observable)
                        value.subscribe(value => element[key] = value);
                    else element[key] = value;
                } else if(value.includes(replacement)) {
                    const parts = value.split(replacement);
                    const values: (string | Observable<string>)[] = [];

                    for(let i = 0; i < parts.length - 1; i++)
                        values.push(getValue());

                    reduce(values.filter(value => value instanceof Observable) as Observable<any>[], newValues => {
                        let s = parts[0]!;
                        let newValueIndex = 0;
                        for(let i = 0; i < values.length; i++) {
                            let value = values[i]!;
                            if(value instanceof Observable) {
                                value = newValues[newValueIndex];
                                newValueIndex++;
                            }
                            s += value + parts[i + 1]!;
                        }
                        element[key] = s;
                    });
                } else element[key] = value;
            }

            if(textOrTag[0].at(-2) === "/"
                || voidTags.includes(element.tagName.toLowerCase())) // self-closing tag or inline
                return element;

            let end: string;
            for(const part of partsIter) {
                const children = parse(part);
                if(children instanceof Array)
                    element.append(...children);
                else if(children instanceof Node)
                    element.append(children);
                else if(typeof children === "string") {
                    end = children;
                    break;
                } else throw new Error(`Unexpected value ${children}`);
            }

            // @ts-ignore
            if(textOrTag[2] !== end)
                // @ts-ignore
                throw new Error(`Start and end tags <${textOrTag[2]}> and </${end}> do not match`);

            return element;
        }

        // end tag
        return textOrTag[13] === replacement ? getValue() : textOrTag[13];
    }

    const nodes = [];
    for(const part of partsIter) {
        const children = parse(part);
        if(children instanceof Array)
            nodes.push(...children);
        else if(children instanceof Node)
            nodes.push(children);
        else throw new Error(`Component or native end tag </${children}> without a start tag`);
    }

    return nodes;
}

/**
 * Dynamically maps the given `ObservableArray` with a mapper function to nodes.
 * Synchronizes this array.
 */
export function map<E>(
    array: ObservableArray<E>,
    mapper: (element: E, index: number) => Node
): Node[] {
    const anchor = document.createTextNode("");
    const nodes = array.map(mapper);

    array.subscribeToRemoveAt(index => {
        const node = nodes.splice(index, 1)[0]!;
        node.parentElement!.removeChild(node);
    });

    array.subscribeToSet((index, element) => {
        const mapped = mapper(element, index);

        if(index < nodes.length) {
            anchor.parentElement!.replaceChild(nodes[index]!, nodes[index]!);
            nodes[index] = mapped;
        } else {
            const last = nodes[nodes.length - 1];
            anchor.parentElement!.insertBefore(mapped, (last ? last : anchor).nextSibling);
            nodes.push(mapped);
        }
    });

    array.subscribeToInsert((index, element) => {
        const mapped = mapper(element, index);
        nodes[index]!.parentElement!.insertBefore(mapped, nodes[index]!);
        nodes.splice(index, 0, mapped);
    });

    array.subscribeToMove((from, to) => {
        const toMove = nodes.splice(from, 1)[0]!;
        anchor.parentElement!.removeChild(toMove);
        anchor.parentElement!.insertBefore(nodes[from]!, toMove);
        nodes.splice(to, 0, toMove);
    });

    return [anchor, ...nodes];
}

export function native(strings: TemplateStringsArray, ...values: any[]): Node[] {
    const dummy = document.createElement("div");
    let builder = strings[0] as string;
    for(let i = 0; i < values.length; i++)
        builder += values[i] + strings[i + 1];
    dummy.innerHTML = builder;
    const nodes = [];
    for(const child of dummy.childNodes)
        nodes.push(child);
    return nodes;
}