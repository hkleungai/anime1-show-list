import Date_Time_Constants from './Date_Time_Constants.mjs';
import Regex_Builder from './Regex_Builder.mjs';
import Site_Constants from './Site_Constants.mjs';

export default class Regex_Constants {
    static get TABLE_BODY() {
        return /<tbody>(?<body>.*)<\/tbody>/;
    };

    static get TABLE_ROW_GLOBAL() {
        return /<tr>(?<row>.*?)<\/tr>/g;
    };

    static get TABLE_CELL_GLOBAL() {
        return (
            new Regex_Builder(/<td>(?!<strong>[!{weekdays}]<\/strong>)(?<cell>.*?)<\/td>/g)
                .build({ weekdays: new RegExp(Date_Time_Constants.SITE_WEEKDAYS.join('|')) })
                .regex
        );
    };

    private static show_link_builder = (
        new Regex_Builder(/^<a href="!{link}">(?<name>.*?)(?:<\/a>.*)?$/)
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
            .build({ link: /!{host}\/\?cat=(?<linkQuery>\d+)/ })
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
                .build({ host: /(?:!{host})?/ })
                .build({ host: new RegExp(Site_Constants.NORMAL_HOME) })
                .regex
        );
    }
}
