import fs from 'node:fs';
import path from 'node:path';

import pug from 'pug';

import { DEFAULT_FULL_SHOW_JSON_BUILDER } from './Full_Show_Json_Builder.mjs';
import Site_Constants from './Site_Constants.mjs';
import Date_Time_Constants from './Date_Time_Constants.mjs';

async function main() {
    const dist_dir_path = path.resolve('dist');
    fs.mkdirSync(dist_dir_path, { recursive: true });

    const dist_show_list_page_out_path = path.resolve(dist_dir_path, 'index.html');

    const real_full_show_json = await retrieve_real_full_show_json();
    const show_list_template_path = path.resolve('src', 'show-list.template.pug');
    const compiled_html = pug.compileFile(show_list_template_path)({ list: real_full_show_json });

    fs.writeFileSync(dist_show_list_page_out_path, compiled_html);
}

async function retrieve_real_full_show_json() {
    const full_show_json = await DEFAULT_FULL_SHOW_JSON_BUILDER.build();
    const full_show_links = full_show_json.flatMap((full_show) => (
        Number(full_show.link?.match(/(?<id>\d+)$/)!.groups!.id) || [])
    );

    const table_list = await retrieve_table_list_json();
    const table_show_links = table_list.flatMap((row_show: unknown[]) => (
        Number(row_show[0]) || []
    ));

    const missing_show_ids = [...new Set(table_show_links).difference(new Set(full_show_links))];

    const missing_show_id_set = new Set(missing_show_ids);
    const missing_show_list = table_list.filter((row_show: unknown[]) => (
        missing_show_id_set.has(Number(row_show[0]))
    ));

    const SEASON_DISPLAYS = Object.values(Date_Time_Constants.Season) as string[];
    const has_well_formed_missing_shows = missing_show_list.every((row_show: unknown[]) => (
        /^\d{4}$/.test(String(row_show[3]))
        && SEASON_DISPLAYS.includes(String(row_show[4]))
    ));

    if (!has_well_formed_missing_shows) {
        throw new Error('Detected malformed missing shows from homelist-js\'s table.');
    }

    return full_show_json.concat(missing_show_list.map((show: any[]) => ({
        weekday: Date_Time_Constants.UNKNOWN_WEEKDAY,
        season: show[4],
        year: Number(show[3]),
        type: Site_Constants.Show_Type.NORMAL,
        name: show[1],
        link: `${Site_Constants.NORMAL_HOME}/?cat=${show[0]}`
    })));
}

async function retrieve_table_list_json(): Promise<Array<any>> {
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

main().catch(console.error);
