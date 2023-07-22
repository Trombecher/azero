import {Observable, ObservableArray} from "./observable";

const tags = /(<([a-zA-Z][a-zA-Z\-\d]*)([^\/"'>]|(("((\\")|[^"])*")|('((\\')|[^'])*')|([^\/"'>\s]+)))*\/?>)|(<\/([a-zA-Z][a-zA-Z\-\d]*)\s*>)/gm;
const attributes = /\s*([^\/"'>\s]+)\s*=\s*(("(((\\")|[^"])*)")|('(((\\')|[^'])*)')|([^\/"'>\s]+))/gm;

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

    function parse(textOrTag: RegExpMatchArray | string): Node[] | string | Function {
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
                        const text = document.createTextNode(value.value + "");
                        value.subscribe(value => text.textContent = value + "", false);
                        nodes.push(text);
                    }
                } else nodes.push(document.createTextNode(value))

                nodes.push(document.createTextNode(split[j]!))
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
                    const value = match[8] || match[4] || match[2];
                    if(value === replacement)
                        params[match[1]!] = getValue();
                    else params[match[1]!] = value;
                }

                params["children"] = [];

                if(textOrTag[0].at(-2) === "/") // inline
                    return component(params);

                let end: Function;
                for(const part of partsIter) {
                    const children = parse(part);
                    if(children instanceof Array)
                        params["children"].push(...children);
                    else if(children instanceof Node)
                        params["children"].push(children)
                    else if(typeof children === "function") {
                        end = children;
                        break;
                    } else throw new Error(`TF?`);
                }

                // @ts-ignore
                if(component !== end)
                    throw new Error("Start and end tags of component do not match");

                return component(params);
            }

            // native
            const element = document.createElement(textOrTag[2]);

            const attributesString = textOrTag[0]
                .substring(1 + textOrTag[2].length, textOrTag[0].length);
            for(const match of attributesString.matchAll(attributes)) {
                let key = match[1];
                if(key === "class") key = "className";
                const value = match[8] || match[4] || match[2];
                if(value === replacement) {
                    const value = getValue();
                    if(value instanceof Observable)
                        // @ts-ignore
                        value.subscribe(value => element[key] = value);
                    // @ts-ignore
                    else element[key] = value;
                }
                // @ts-ignore
                else element[key] = value;
            }

            if(textOrTag[0].at(-2) === "/") // inline
                return [element];

            let end: string;
            for(const part of partsIter) {
                const children = parse(part);
                if(children instanceof Array)
                    element.append(...children);
                else if(children instanceof Node)
                    element.append(children)
                else if(typeof children === "string") {
                    end = children;
                    break;
                } else throw new Error(`TF?`);
            }

            // @ts-ignore
            if(textOrTag[2] !== end)
            // @ts-ignore
                throw new Error(`Start and end tags <${textOrTag[2]}> and </${end}> do not match`);

            return [element];
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
            nodes.push(children)
        else throw new Error(`TF?`);
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