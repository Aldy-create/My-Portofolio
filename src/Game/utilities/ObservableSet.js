export default class ObservableSet extends Set
{
    constructor(callback = null, iterable = [])
    {
        super()
        this.callback = callback
        for(const item of iterable)
            this.add(item)
    }

    add(value)
    {
        const had = this.has(value)
        super.add(value)
        if(!had && typeof this.callback === 'function')
            this.callback({ type: 'add', value })
        return this
    }

    delete(value)
    {
        const had = this.has(value)
        const result = super.delete(value)
        if(had && typeof this.callback === 'function')
            this.callback({ type: 'delete', value })
        return result
    }

    clear()
    {
        const previousValues = [...this.values()]
        super.clear()
        if(previousValues.length > 0 && typeof this.callback === 'function')
            this.callback({ type: 'clear', previousValues })
    }
}
