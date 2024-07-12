import pug from 'pug';

export default class Format {
    static string(val: string, options: pug.LocalsObject) {
        const compiled = pug.compile(`<tag val="${val}"/>`)(options);
        return compiled.match(/^<tag val="(?<val>.*?)"\/>$/)!.groups!.val;
    }
}
