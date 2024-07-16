import Weekdays from "./Weekdays.mjs";

namespace Date_Time_Constants {
    export const EARLIEST_YEAR = 2017;
    export const CURRENT_YEAR = new Date().getFullYear();

    export const Season = {
        FALL:   '秋',
        SUMMER: '夏',
        SPRING: '春',
        WINTER: '冬',
    } as const satisfies Record<string, string>;

    export const OUTPUT_WEEKDAYS = (() => {
        const formats = [
            { label: 'zh_HK', locales: 'zh-HK', weekday: 'long' } as const,
            { label: 'ja_JP', locales: 'ja-JP', weekday: 'long' } as const,
        ];
        const display = '!{zh_HK}（!{ja_JP}）';
        return new Weekdays(formats, display).build();
    })()

    export const SITE_WEEKDAYS = (() => {
        const formats = [{ label: 'zh_HK', locales: 'zh-HK', weekday: 'narrow' } as const];
        const display = '!{zh_HK}';
        return new Weekdays(formats, display).build();
    })();

    export const UNKNOWN_WEEKDAY = '不明';

    export type Season_Key = keyof typeof Date_Time_Constants.Season;
    export type Season_Value = (typeof Date_Time_Constants.Season)[Season_Key];
}

export default Date_Time_Constants;
