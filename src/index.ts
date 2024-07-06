import fs from 'node:fs';
import path from 'node:path';

import HtmlEntity from 'he';
import pug from 'pug';

async function main() {
    const dist_dir_path = path.resolve('dist');
    if (fs.existsSync(dist_dir_path) && fs.lstatSync(dist_dir_path).isDirectory()) {
        fs.rmSync(dist_dir_path, { recursive: true });
    }
    fs.mkdirSync(dist_dir_path, { recursive: true });

    const dist_show_list_page_out_path = path.resolve(dist_dir_path, 'index.html');

    const full_show_json = await create_full_show_json();
    const show_list_template_path = path.resolve('src', 'show-list.template.pug');
    const compiled_html = pug.compileFile(show_list_template_path)({ list: full_show_json });

    fs.writeFileSync(dist_show_list_page_out_path, compiled_html);
};

async function create_full_show_json() {
    let builders: Array<Show_Json_Builder> = [];
    for (let yr = Date_Time_Constants.CURRENT_YEAR; yr >= Date_Time_Constants.EARLIEST_YEAR; yr--) {
        for (let season in Date_Time_Constants.Season) {
            builders.push(new Show_Json_Builder(yr, season as Date_Time_Constants.Season_Key));
        }
    }

    const showChunks = await Promise.all(builders.map(async (builder) => {
        try {
            return await builder.build();
        } catch {
            return [];
        }
    }));

    return showChunks.flatMap((chunk) => chunk);
}

class Show_Json_Builder {
    constructor(private year: number, private season: Date_Time_Constants.Season_Key) {
        if (!this.isYearValid(year)) {
            throw new Error(`Invalid year ${year}`);
        }
    }

    async build(): Promise<Array<Show_Json_Builder.Show_Json_Entry>> {
        const response = await fetch(this.link).then(response => response.text());
        const table = Show_Json_Builder.scrape_table_from(response);
        return this.create_show_json_from(table);
    }

    private create_show_json_from(table: string[][]): Array<Show_Json_Builder.Show_Json_Entry> {
        return table.flatMap((rows) => rows.flatMap((show, index) => {
            if (!show) {
                return [];
            }

            const partialResult = {
                weekday: Date_Time_Constants.OUTPUT_WEEKDAYS[index],
                season: Date_Time_Constants.Season[this.season],
                year: this.year,
            }

            const show_hentai_match = show.match(Regex_Constants.SHOW_HENTAI_NAME_LINK_QUERY);
            if (show_hentai_match) {
                const { name, linkQuery } = show_hentai_match.groups!;
                return {
                    ...partialResult,
                    type: Site_Constants.Show_Type.HENTAI,
                    name: HtmlEntity.decode(name),
                    link: `${Site_Constants.HENTAI_HOME}/?cat=${linkQuery}`,
                };
            }

            const show_normal_match = show.match(Regex_Constants.SHOW_NORMAL_NAME_LINK_QUERY);
            if (show_normal_match) {
                const { name, linkQuery } = show_normal_match.groups!;
                return {
                    ...partialResult,
                    type: Site_Constants.Show_Type.NORMAL,
                    name: HtmlEntity.decode(name),
                    link: `${Site_Constants.NORMAL_HOME}/?cat=${linkQuery}`,
                };
            }

            const show_external_match = show.match(Regex_Constants.SHOW_EXTERNAL_NAME_LINK_QUERY);
            if (show_external_match) {
                const { name, link } = show_external_match.groups!;
                return {
                    ...partialResult,
                    type: Site_Constants.Show_Type.EXTERNAL,
                    name: HtmlEntity.decode(name),
                    link,
                };
            }

            return {
                ...partialResult,
                type: Site_Constants.Show_Type.NOT_IN_SITE,
                name: HtmlEntity.decode(show),
                link: null,
            };
        }));
    }

    private static scrape_table_from(htmlString: string): string[][] {
        const body_match = htmlString.match(Regex_Constants.TABLE_BODY);
        if (!body_match) {
            throw new Error(`Cannot find table body on ${Json_String.build({ htmlString })}`);
        }

        const { body } = body_match.groups!;

        const row_matches = [...body.matchAll(Regex_Constants.TABLE_ROW_GLOBAL)];
        if (row_matches.length === 0) {
            throw new Error(`Cannot find table on ${Json_String.build({ body })}`);
        }

        return row_matches.map((row_match) => {
            const { row } = row_match.groups!;

            const cell_matches = [...row.matchAll(Regex_Constants.TABLE_CELL_GLOBAL)];
            if (cell_matches.length === 0) {
                console.warn(`Skipping malformed table row, ${Json_String.build({ row })}`);
                return [];
            }

            return [...cell_matches].map((cell_match) => cell_match.groups!.cell);
        });
    }

    private isYearValid(year: number) {
        return (
            Number.isSafeInteger(year)
            && year >= Date_Time_Constants.EARLIEST_YEAR
            && year <= Date_Time_Constants.CURRENT_YEAR
        )
    }

    private get link() {
        const season_query = Date_Time_Constants.Season[this.season];
        return `${Site_Constants.NORMAL_HOME}/${this.year}年${season_query}新番`;
    }
}

namespace Show_Json_Builder {
    export type Show_Json_Entry = (
        & {
            weekday: string;
            season: Date_Time_Constants.Season_Value;
            year: number;
            name: string;
        }
        & (
            | {
                type: Omit<Site_Constants.Show_Type_Key, 'NOT_IN_SITE'>;
                link: string;
            }
            | {
                type: 'NOT_IN_SITE';
                link: null;
            }
        )
    );
}

class Json_String {
    static build(obj: any) { return JSON.stringify(obj, null, 4); }
}

class Format {
    static string(src: string, options: pug.LocalsObject) {
        const compiled = pug.compile(`<regex src="${src}"/>`)(options);
        const { regex } = compiled.match(/^<regex src="(?<regex>.*?)"\/>$/)!.groups!;
        return HtmlEntity.decode(regex);
    }
}

class Regex_Builder {
    private _regex: RegExp;
    private flags: string;
    constructor(input_regex: RegExp) {
        this._regex = new RegExp(input_regex, '');
        this.flags = input_regex.flags;
    }

    build(options: Record<string, RegExp>): Regex_Builder {
        let pattern_options: Record<string, string> = {};
        for (const key in options) {
            pattern_options[key] = Regex_Builder.create_regex_string_from(options[key]);
        }
        const computed_regex = new RegExp(this.create_pattern_from(pattern_options), this.flags);
        return new Regex_Builder(computed_regex);
    }

    private create_pattern_from(options: pug.LocalsObject) {
        const raw_regex_str = Regex_Builder.create_regex_string_from(this._regex);
        return Format.string(raw_regex_str, options);
    }

    private static create_regex_string_from(input_regex: RegExp): string {
        return input_regex.toString().replace(/^\/|\/$/g, '');
    }

    private set regex(input_regex: RegExp) { this._regex = input_regex; };
    public get regex(): RegExp { return new RegExp(this._regex, this.flags); }
}

class Regex_Constants {
    static get TABLE_BODY() {
        return /<tbody>(?<body>.*)<\/tbody>/;
    };

    static get TABLE_ROW_GLOBAL() {
        return /<tr>(?<row>.*?)<\/tr>/g;
    };

    private static table_cell_global_builder = (
        new Regex_Builder(/<td>(?!<strong>[#{weekdays}]<\/strong>)(?<cell>.*?)<\/td>/g)
    );

    static get TABLE_CELL_GLOBAL() {
        return (
            Regex_Constants.table_cell_global_builder
                .build({ weekdays: new RegExp(Date_Time_Constants.SITE_WEEKDAYS.join('|')) })
                .regex
        );
    };

    private static show_link_builder = (
        new Regex_Builder(/^<a href="#{link}">(?<name>.*?)(?:<\/a>.*)?$/)
    );

    static get SHOW_EXTERNAL_NAME_LINK_QUERY() {
        return (
            Regex_Constants.show_link_builder
                .build({ link: /(?<link>.*?)/ })
                .regex
        );
    }

    private static show_cat_link_builder = (
        Regex_Constants.show_link_builder
            .build({ link: /#{host}\/\?cat=(?<linkQuery>\d+)/ })
    );

    static get SHOW_HENTAI_NAME_LINK_QUERY() {
        return (
            Regex_Constants.show_cat_link_builder
                .build({ host: new RegExp(Site_Constants.HENTAI_HOME) })
                .regex
        );
    }

    static get SHOW_NORMAL_NAME_LINK_QUERY() {
        return (
            Regex_Constants.show_cat_link_builder
                .build({ host: /(#{host})?/ })
                .build({ host: new RegExp(Site_Constants.NORMAL_HOME) })
                .regex
        );
    }
}

class Weekdays {
    constructor(
        private formats: Array<{
            label: string,
            locales?: Intl.LocalesArgument
            weekday?: Intl.DateTimeFormatOptions['weekday']
        }>,
        private display: string
    ) {}

    build(): [string, string, string, string, string, string, string] {
        return Weekdays.range_0_6.map((day) => {
            let formatter_lookup: Record<string, string> = {};
            for (const { label, locales, weekday } of this.formats) {
                const dateTimeFormat = new Intl.DateTimeFormat(locales, { weekday });
                formatter_lookup[label] = dateTimeFormat.format(new Date(Date.UTC(2024, 6, day)));
            }
            return Format.string(this.display, formatter_lookup);
        }) as [string, string, string, string, string, string, string];
    }

    private static range_0_6 = [...Array(7).keys()];
}

namespace Date_Time_Constants {
    export const EARLIEST_YEAR = 2017;
    export const CURRENT_YEAR = new Date().getFullYear();

    export const Season = {
        FALL: '秋季',
        SUMMER: '夏季',
        SPRING: '春季',
        WINTER: '冬季',
    } as const satisfies Record<string, string>;

    export const OUTPUT_WEEKDAYS = (() => {
        const formats = [
            { label: 'zh_HK', locales: 'zh-HK', weekday: 'long' } as const,
            { label: 'ja_JP', locales: 'ja-JP', weekday: 'long' } as const,
        ];
        const display = '#{zh_HK}（#{ja_JP}）';
        return new Weekdays(formats, display).build();
    })()

    export const SITE_WEEKDAYS = (() => {
        const formats = [{ label: 'zh_HK', locales: 'zh-HK', weekday: 'narrow' } as const];
        const display = '#{zh_HK}';
        return new Weekdays(formats, display).build();
    })();
}

namespace Date_Time_Constants {
    export type Season_Key = keyof typeof Date_Time_Constants.Season;
    export type Season_Value = (typeof Date_Time_Constants.Season)[Season_Key];
}

namespace Site_Constants {
    export const NORMAL_HOME = 'https://anime1.me';

    export const HENTAI_HOME = 'https://anime1.pw';

    export const Show_Type = {
        HENTAI: 'HENTAI',
        NORMAL: 'NORMAL',
        EXTERNAL: 'EXTERNAL',
        NOT_IN_SITE: 'NOT_IN_SITE',
    } as const satisfies Record<string, string>;

    export type Show_Type_Key = keyof typeof Site_Constants.Show_Type;
}

main().catch(console.error);
