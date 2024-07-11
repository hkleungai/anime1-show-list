namespace Site_Constants {
    export const NORMAL_HOME = 'https://anime1.me';

    export const HENTAI_HOME = 'https://anime1.pw';

    export const Show_Type = {
        HENTAI: 'HENTAI',
        NORMAL: 'NORMAL',
        EXTERNAL: 'EXTERNAL',
        NOT_IN_SITE: 'NOT_IN_SITE',
    } as const satisfies Record<string, string>;

    export type Show_Type_Key = keyof typeof Site_Constants.Show_Type;
}

export default Site_Constants;
