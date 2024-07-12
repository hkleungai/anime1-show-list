import Format from './Format.mjs';

export default class Regex_Builder {
    private _regex: RegExp;
    private flags: string;
    constructor(input_regex: RegExp) {
        this._regex = new RegExp(input_regex, '');
        this.flags = input_regex.flags;
    }

    build(ctx_regex_lookup: Record<string, RegExp>): Regex_Builder {
        let ctx_string_lookup: Record<string, string> = {};
        for (const key in ctx_regex_lookup) {
            const pattern = new RegExp(ctx_regex_lookup[key], '');
            ctx_string_lookup[key] = Regex_Builder.create_regex_string_from(pattern);
        }

        const raw_regex_str = Regex_Builder.create_regex_string_from(this._regex);
        const rich_regex_str = Format.string(raw_regex_str, ctx_string_lookup);
        const result_regex = new RegExp(rich_regex_str, this.flags);

        return new Regex_Builder(result_regex);
    }

    private static create_regex_string_from(input_regex: RegExp): string {
        if (input_regex instanceof RegExp) {
            return input_regex.toString().replace(/^\/|\/$/g, '');
        }
        throw new Error(`Expected a regex. Received ${input_regex}`)
    }

    private set regex(input_regex: RegExp) { this._regex = input_regex; };
    public get regex(): RegExp { return new RegExp(this._regex, this.flags); }
}
