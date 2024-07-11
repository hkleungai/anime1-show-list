export default class Json_String {
    static build(obj: any) { return JSON.stringify(obj, null, 4); }
}
