import Format from './Format.mjs';

export default class Weekdays {
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
                const date_time_format = new Intl.DateTimeFormat(locales, { weekday });
                const nice_date = new Date(Date.UTC(2024, 6, day));
                formatter_lookup[label] = date_time_format.format(nice_date);
            }
            return Format.string(this.display, formatter_lookup);
        }) as [string, string, string, string, string, string, string];
    }

    private static range_0_6 = [...Array(7).keys()];
}
