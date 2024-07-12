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
                const dateTimeFormat = new Intl.DateTimeFormat(locales, { weekday });
                formatter_lookup[label] = dateTimeFormat.format(new Date(Date.UTC(2024, 6, day)));
            }
            return Format.string(this.display, formatter_lookup);
        }) as [string, string, string, string, string, string, string];
    }

    private static range_0_6 = [...Array(7).keys()];
}
