#!/bin/sh
':' //; DISABLE_WARNING=$(echo "                    \
':' //;     --disable-warning='DEP0180'             \
':' //;     --disable-warning='ExperimentalWarning' \
':' //; " | sed -E "s=':' //;==g; s=^ +| +$==g; s= += =g");
':' //;
':' //; ENABLE=$(echo "             \
':' //;     --enable-source-maps    \
':' //; " | sed -E "s=':' //;==g; s=^ +| +$==g; s= += =g");
':' //;
':' //; ENV=$(echo "                \
':' //;     TS_NODE_PRETTY=true     \
':' //; " | sed -E "s=':' //;==g; s=^ +| +$==g; s= += =g");
':' //;
':' //; IMPORT=$(echo "                                                             \
':' //;     data:text/javascript,                                                   \
':' //;         import { register } from 'node:module';                             \
':' //;         import { setUncaughtExceptionCaptureCallback } from 'node:process'; \
':' //;         import { pathToFileURL } from 'node:url';                           \
':' //;                                                                             \
':' //;         setUncaughtExceptionCaptureCallback(console.error);                 \
':' //;                                                                             \
':' //;         const import_url = pathToFileURL(import.meta.url).href;             \
':' //;         register('ts-node/esm', import_url);                                \
':' //; " | sed -E "s=':' //;==g; s=^ +| +$==g; s= += =g");
':' //; IMPORT="--import=\"$IMPORT\""
':' //;
':' //; sh -c "$ENV node $IMPORT $DISABLE_WARNING $ENABLE $@ $0";
':' //;
':' //; exit;

import fs from 'node:fs';
import path from 'node:path';

import pug from 'pug';

import { DEFAULT_FULL_SHOW_JSON_BUILDER } from './Full_Show_Json_Builder.mjs';
import Site_Constants from './Site_Constants.mjs';
import Date_Time_Constants from './Date_Time_Constants.mjs';

void async function main() {
    cmd_print();

    const dist_dir_path = path.resolve('dist');
    fs.mkdirSync(dist_dir_path, { recursive: true });

    const dist_show_list_page_out_path = path.resolve(dist_dir_path, 'index.html');

    const real_full_show_json = await retrieve_real_full_show_json();
    const show_list_template_path = path.resolve('src', 'show-list.template.pug');
    const compiled_html = pug.compileFile(show_list_template_path)({
        list: real_full_show_json,
        sorted_season_lookup: Date_Time_Constants.Season,
    });

    fs.writeFileSync(dist_show_list_page_out_path, compiled_html);
}();

async function retrieve_real_full_show_json() {
    const full_show_json = await DEFAULT_FULL_SHOW_JSON_BUILDER.build();
    const full_show_links = full_show_json.flatMap((full_show) => (
        Number(full_show.link?.match(/(?<id>\d+)$/)!.groups!.id) || [])
    );

    const table_list = await retrieve_table_list_json();

    const table_show_links = table_list.flatMap((row_show) => (
        Number(row_show[0]) || []
    ));

    const missing_show_ids = [...new Set(table_show_links).difference(new Set(full_show_links))];

    const missing_show_id_set = new Set(missing_show_ids);
    const missing_show_list = table_list.filter((row_show) => (
        missing_show_id_set.has(Number(row_show[0]))
    ));

    const SEASON_DISPLAYS = Object.values(Date_Time_Constants.Season) as string[];
    const has_well_formed_missing_shows = missing_show_list.every((row_show) => (
        /^\d{4}$/.test(String(row_show[3]))
        && SEASON_DISPLAYS.includes(String(row_show[4]))
    ));

    if (!has_well_formed_missing_shows) {
        throw new Error('Detected malformed missing shows from homelist-js\'s table.');
    }

    const missing_show_json = missing_show_list.map((show) => ({
        weekday: Date_Time_Constants.UNKNOWN_WEEKDAY,
        season: show[4] as Date_Time_Constants.Season_Value,
        year: Number(show[3]),
        type: Site_Constants.Show_Type.NORMAL,
        name: show[1] as string,
        link: `${Site_Constants.NORMAL_HOME}/?cat=${show[0]}`,
        episodes: show[2],
        id: show[0],
    }));

    const show_id_to_show_lookup = Map.groupBy(full_show_json, (show) => show.id);
    const non_missing_names = new Set<string>();
    for (const [id, name, episodes] of table_list) {
        if (!show_id_to_show_lookup.has(id)) {
            continue;
        }
        for (const show of show_id_to_show_lookup.get(id)!) {
            show.id ||= id;
            show.link ||= `${Site_Constants.NORMAL_HOME}/?cat=${id}`;
            show.episodes ||= episodes;
        }
        non_missing_names.add(name);
    }

    return full_show_json.concat(
        missing_show_json.filter(({ name }) => !non_missing_names.has(name))
    );
}

/**
 * - Id
 * - Name / Label
 * - Episodes
 * - Year
 * - Season
 * - 字幕組
 */
async function retrieve_table_list_json(): Promise<Array<[
    number,
    string,
    string,
    string,
    string,
    string,
]>> {
    const home_response = await fetch(Site_Constants.NORMAL_HOME).then(r => r.text());

    const homelist_tag_regex = /<script.*src="(?<src>(?!<\/script>).*)" id="homelist-js/;
    const homelist_tag_match = home_response.match(homelist_tag_regex);
    if (!homelist_tag_match) {
        throw new Error('Cannot find script tag with id="homelist-js"');
    }

    const homelist_src = homelist_tag_match!.groups!.src;
    const homelist_full_src = new URL(homelist_src, Site_Constants.NORMAL_HOME).href;
    const homelist_response = await fetch(homelist_full_src).then(r => r.text());

    const create_fake_jquery_string = create_fake_jquery.toString();
    const create_fake_jquery_body_match = create_fake_jquery_string.match(
        /function\s+\w+\(.*\)\s+\{(?<fn_body>[\s\S]+)\}/
    );
    if (!create_fake_jquery_body_match) {
        throw new Error('Unreachable! create_fake_jquery() down there must match the regex!');
    }

    const create_fake_jquery_body = create_fake_jquery_body_match.groups!.fn_body;

    const table_list_args = await new Function(`
        ${create_fake_jquery_body};
        return ${homelist_response};
    `)();

    if (!table_list_args || !table_list_args.ajax || !table_list_args.ajax.url) {
        throw new Error('Cannot retrieve ajax url for table_list at homelist.js');
    }

    const table_list_href = new URL(table_list_args.ajax.url, Site_Constants.NORMAL_HOME).href;
    return await fetch(table_list_href).then(r => r.json());
}

function create_fake_jquery() {
    // @ts-ignore
    const jQuery = (f) => {
        const { promise, resolve, reject } = Promise.withResolvers();

        // @ts-ignore
        f((class_name) => (
            class_name === '#table-list')
                ? { dataTable: resolve }
                : reject(new Error('dataTable not found'))
        );

        return promise;
    };
}

function cmd_print() {
    const [first, ...rest] = process.argv.concat(process.execArgv);

    console.log(`\x1b[90m$ ${first}            \x1b[0m`);

    for (const arg of rest) {
        console.log(`\x1b[90m    ${arg}        \x1b[0m`);
    }
}
