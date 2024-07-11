import fs from 'node:fs';
import path from 'node:path';

import Json_String from './Json_String.mjs';
import Site_Constants from './Site_Constants.mjs';

async function main() {
    const dist_dir_path = path.resolve('dist');
    fs.mkdirSync(dist_dir_path, { recursive: true });

    const table_list = await retrieve_table_list_json();
    const table_list_output_path = path.resolve(dist_dir_path, 'wip.home-table-list.json');
    fs.writeFileSync(table_list_output_path, Json_String.build({ table_list }));
}

async function retrieve_table_list_json() {
    const home_response = await fetch(Site_Constants.NORMAL_HOME).then(r => r.text());

    const homelist_match = home_response.match(
        /(?:id="datatable-js"><\/script>)<script type="text\/javascript" src="(?<src>.*?)" id="homelist-js"><\/script>/
    );
    if (!homelist_match) {
        throw new Error('Cannot find script tag with id="homelist-js"');
    }

    const homelist_src = homelist_match!.groups!.src;
    const homelist_full_src = new URL(homelist_src, Site_Constants.NORMAL_HOME).href;

    const homelist_response = await fetch(homelist_full_src).then(r => r.text());

    const create_fake_jquery_string = create_fake_jquery.toString();
    const create_fake_jquery_body = (
        create_fake_jquery_string.slice(
            create_fake_jquery_string.indexOf("{") + 1,
            create_fake_jquery_string.lastIndexOf("}")
        )
    );
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
