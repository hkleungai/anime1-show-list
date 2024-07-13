import Html_Entity from 'he';

import Date_Time_Constants from './Date_Time_Constants.mjs';
import Json_String from './Json_String.mjs';
import Regex_Constants from './Regex_Constants.mjs';
import Site_Constants from './Site_Constants.mjs';

class Year_Show_Json_Builder {
    constructor(private year: number, private season: Date_Time_Constants.Season_Key) {
        if (!this.is_year_valid(year)) {
            throw new Error(`Invalid year ${year}`);
        }
    }

    async build(): Promise<Array<Year_Show_Json_Builder.Show_Json_Entry>> {
        const response = await fetch(this.link).then(response => response.text());
        const table = Year_Show_Json_Builder.scrape_table_from(response);
        return this.create_show_json_from(table);
    }

    private create_show_json_from(table: string[][]): Array<Year_Show_Json_Builder.Show_Json_Entry> {
        return table.flatMap((rows) => rows.flatMap((show, index) => {
            if (!show) {
                return [];
            }

            const partial_result = {
                weekday: Date_Time_Constants.OUTPUT_WEEKDAYS[index],
                season: Date_Time_Constants.Season[this.season],
                year: this.year,
            }

            const show_hentai_match = show.match(Regex_Constants.SHOW_HENTAI_NAME_LINK_QUERY);
            if (show_hentai_match) {
                return [];
            }

            const show_normal_match = show.match(Regex_Constants.SHOW_NORMAL_NAME_LINK_QUERY);
            if (show_normal_match) {
                const { name, link_query } = show_normal_match.groups!;
                return {
                    ...partial_result,
                    type: Site_Constants.Show_Type.NORMAL,
                    name: Html_Entity.decode(name),
                    link: `${Site_Constants.NORMAL_HOME}/?cat=${link_query}`,
                };
            }

            const show_external_match = show.match(Regex_Constants.SHOW_EXTERNAL_NAME_LINK_QUERY);
            if (show_external_match) {
                return [];
            }

            return {
                ...partial_result,
                type: Site_Constants.Show_Type.NOT_IN_SITE,
                name: Html_Entity.decode(show),
                link: null,
            };
        }));
    }

    private static scrape_table_from(html_string: string): string[][] {
        const body_match = html_string.match(Regex_Constants.TABLE_BODY);
        if (!body_match) {
            throw new Error(`Cannot find table body on ${Json_String.build({ html_string })}`);
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

    private is_year_valid(year: number) {
        return (
            Number.isSafeInteger(year)
            && year >= Date_Time_Constants.EARLIEST_YEAR
            && year <= Date_Time_Constants.CURRENT_YEAR
        )
    }

    private get link() {
        const season_query = Date_Time_Constants.Season[this.season];
        return `${Site_Constants.NORMAL_HOME}/${this.year}年${season_query}季新番`;
    }
}

namespace Year_Show_Json_Builder {
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

export default Year_Show_Json_Builder;
