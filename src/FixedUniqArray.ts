export default class FixedUniqArray<T> {
    private list = new Set<T>();

    constructor(private length: number) {}

    public delete(item: T) {
        this.list.delete(item);
    }

    public push(item: T) {
        // Delete item from any position in the list.
        this.delete(item);

        // Add item to last position.
        this.list.add(item);
    }

    public replace(curItem: T, newItem: T) {
        const list = this.get();
        if (!this.list.has(curItem)) {
            return;
        }

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (item === curItem) {
                list[i] = newItem;
                break;
            }
        }

        this.list = new Set(list);
    }

    public get() {
        const list = Array.from(this.list).slice(-this.length);
        this.list = new Set(list);
        return list;
    }

    public destructor() {
        this.list.clear();
    }
}
