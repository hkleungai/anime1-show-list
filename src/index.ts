import fs from 'node:fs';
import path from 'node:path';

import HtmlEntity from 'he';
import pug from 'pug';

async function main() {
    const show_list_template_path = path.resolve('src', 'show-list.template.pug');
    const show_list_template = fs.readFileSync(show_list_template_path, { encoding: 'utf-8' });
    const compiled_html = pug.compile(show_list_template)({
        list: await create_full_show_json()
    });

    const dist_dir_path = path.resolve('dist');
    if (fs.existsSync(dist_dir_path) && fs.lstatSync(dist_dir_path).isDirectory()) {
        fs.rmSync(dist_dir_path, { recursive: true });
    }
    fs.mkdirSync(dist_dir_path, { recursive: true });

    const dist_show_list_page_out_path = path.resolve(dist_dir_path, 'index.html');
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
        if (!this.#isYearValid(year)) {
            throw new Error(`Invalid year ${year}`);
        }
    }

    async build(): Promise<Array<Show_Json_Builder.Show_Json_Entry>> {
        const response = await fetch(this.#link).then(response => response.text());
        const table = Show_Json_Builder.#scrape_table_from(response);
        return this.#create_show_json_from(table);
    }

    #create_show_json_from(table: string[][]): Array<Show_Json_Builder.Show_Json_Entry> {
        return table.flatMap((rows) => rows.flatMap((show, index) => {
            if (!show) {
                return [];
            }

            const partialResult = {
                weekday: Date_Time_Constants.WEEKDAY_LABELS[index],
                season: Date_Time_Constants.Season[this.season],
                year: this.year,
            }

            const showHentaiNameLinkMatch = show.match(RegexConstants.SHOW_HENTAI_NAME_LINK_QUERY);
            if (showHentaiNameLinkMatch) {
                const { name, linkQuery } = showHentaiNameLinkMatch.groups!;
                return {
                    ...partialResult,
                    type: Site_Constants.Show_Type.HENTAI,
                    name: HtmlEntity.decode(name),
                    link: `${Site_Constants.HENTAI_HOME}/?cat=${linkQuery}`,
                };
            }

            const showNormalNameLinkMatch = show.match(RegexConstants.SHOW_NORMAL_NAME_LINK_QUERY);
            if (showNormalNameLinkMatch) {
                const { name, linkQuery } = showNormalNameLinkMatch.groups!;
                return {
                    ...partialResult,
                    type: Site_Constants.Show_Type.NORMAL,
                    name: HtmlEntity.decode(name),
                    link: `${Site_Constants.NORMAL_HOME}/?cat=${linkQuery}`,
                };
            }

            const showExternalNameLinkMatch = show.match(RegexConstants.SHOW_EXTERNAL_NAME_LINK_QUERY);
            if (showExternalNameLinkMatch) {
                const { name, link } = showExternalNameLinkMatch.groups!;
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

    static #scrape_table_from(htmlString: string): string[][] {
        const table_body_match = htmlString.match(RegexConstants.TABLE_BODY);
        if (!table_body_match) {
            throw new Error(`Cannot find table_body on ${Json_String.build({ htmlString })}`);
        }

        const { table_body } = table_body_match.groups!;

        const table_row_matches = [...table_body.matchAll(RegexConstants.TABLE_ROW_GLOBAL)];
        if (!table_row_matches.length) {
            throw new Error(`Cannot find table on ${Json_String.build({ table_body })}`);
        }

        return table_row_matches.map((table_row_match) => {
            const { table_row } = table_row_match.groups!;

            const table_cell_matches = [...table_row.matchAll(RegexConstants.TABLE_CELL_GLOBAL)];
            if (!table_cell_matches.length || RegexConstants.TABLE_WEEKDAY_CELL.test(table_row)) {
                console.warn(`Skipping malformed table row, ${Json_String.build({ row: table_row })}`);
                return [];
            }

            return [...table_cell_matches].map((table_cell_match) => table_cell_match.groups!.table_cell)
        });
    }

    #isYearValid(year: number) {
        return (
            Number.isSafeInteger(year)
            && year >= Date_Time_Constants.EARLIEST_YEAR
            && year <= Date_Time_Constants.CURRENT_YEAR
        )
    }

    get #link() {
        return `${Site_Constants.NORMAL_HOME}/${this.year}年${Date_Time_Constants.Season[this.season]}新番`;
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
    static build(obj: any) {
        return JSON.stringify(obj, null, 4);
    }
}

namespace RegexConstants {
    export const TABLE_BODY = /<tbody>(?<table_body>.*)<\/tbody>/;
    export const TABLE_ROW_GLOBAL = /<tr>(?<table_row>.*?)<\/tr>/g;
    export const TABLE_CELL_GLOBAL = /<td>(?<table_cell>.*?)<\/td>/g;
    export const TABLE_WEEKDAY_CELL = /^(?:<td>(?:<strong>(?:日|一|二|三|四|五|六)<\/strong>*?)<\/td>)+$/;
    export const SHOW_EXTERNAL_NAME_LINK_QUERY = /^<a href="(?<link>.*?)">(?<name>.*?)(?:<\/a>.*)?$/;
    export const SHOW_HENTAI_NAME_LINK_QUERY = /^<a href="https\:\/\/anime1\.pw\/\?cat\=(?<linkQuery>\d+)">(?<name>.*?)(?:<\/a>.*)?$/;
    export const SHOW_NORMAL_NAME_LINK_QUERY = /^<a href="(https\:\/\/anime1\.me)?\/\?cat\=(?<linkQuery>\d+)">(?<name>.*?)(?:<\/a>.*)?$/;
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

    export type Season_Key = keyof typeof Season;
    export type Season_Value = (typeof Season)[Season_Key];

    export const WEEKDAY_LABELS = (() => {
        const format = (localeName: string, day: number) => {
            const dateTimeFormat = new Intl.DateTimeFormat(localeName, { weekday: 'long' });
            return dateTimeFormat.format(new Date(Date.UTC(2024, 6, day)));
        };

        const range_0_6 = [...Array(7).keys()];

        return range_0_6.map((day) => `${format('zh-HK', day)}（${format('ja-JP', day)}）`);
    })() as [string, string, string, string, string, string, string];
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

    export type Show_Type_Key = keyof typeof Show_Type;
}

main().catch(console.error);
