import Date_Time_Constants from "./Date_Time_Constants.mjs";
import Year_Show_Json_Builder from "./Year_Show_Json_Builder.mjs";

export default class Full_Show_Json_Builder {
    private builder_list: Array<Year_Show_Json_Builder>;
    constructor(private begin_year: number, private end_year: number) {
        this.builder_list = []
        for (let yr = this.end_year; yr >= this.begin_year; yr--) {
            for (let season in Date_Time_Constants.Season) {
                const builder = new Year_Show_Json_Builder(yr, season as Date_Time_Constants.Season_Key);
                this.builder_list.push(builder);
            }
        }
    }

    async build(): Promise<Year_Show_Json_Builder.Show_Json_Entry[]> {
        const show_chunks = await Promise.all(this.builder_list.map(async (builder) => {
            try {
                return await builder.build();
            } catch {
                return [];
            }
        }));

        return show_chunks.flatMap((chunk) => chunk);
    }
}

export const DEFAULT_FULL_SHOW_JSON_BUILDER = new Full_Show_Json_Builder(
    Date_Time_Constants.EARLIEST_YEAR,
    Date_Time_Constants.CURRENT_YEAR
);
