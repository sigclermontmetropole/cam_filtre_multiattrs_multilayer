// import { ImmutableObject } from 'seamless-immutable'
import { UseDataSource, Immutable, ImmutableObject } from 'jimu-core'

export interface Config {
    buttonFilters: string[],
    dataFilters: string[],
    vertical: boolean
}

export type IMConfig = ImmutableObject<Config>
