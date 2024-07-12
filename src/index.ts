import fs from 'node:fs';
import path from 'node:path';

import pug from 'pug';

import { DEFAULT_FULL_SHOW_JSON_BUILDER } from './Full_Show_Json_Builder.mjs';

async function main() {
    const dist_dir_path = path.resolve('dist');
    fs.mkdirSync(dist_dir_path, { recursive: true });

    const dist_show_list_page_out_path = path.resolve(dist_dir_path, 'index.html');

    const full_show_json = await DEFAULT_FULL_SHOW_JSON_BUILDER.build();
    const show_list_template_path = path.resolve('src', 'show-list.template.pug');
    const compiled_html = pug.compileFile(show_list_template_path)({ list: full_show_json });

    fs.writeFileSync(dist_show_list_page_out_path, compiled_html);
};

main().catch(console.error);
