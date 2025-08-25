import { Address, beginCell, Cell, Contract, ContractProvider, Dictionary, Sender, SendMode } from '@ton/core';
import { parseUserData, parseUserLiteData } from '../api/parser';
import { OPCODES } from '../constants/general';
import { MAINNET_POOL_CONFIG } from '../constants/pools';
import { ExtendedAssetsConfig, ExtendedAssetsData, PoolConfig } from '../types/Master';
import { UserData, UserLiteData } from '../types/User';

/**
 * User contract wrapper
 */
export class EvaaUser implements Contract {
    readonly address: Address;
    private lastSync = 0;
    private _liteData?: UserLiteData;
    private _data?: UserData;
    private poolConfig: PoolConfig;

    /**
     * Create user contract wrapper from address
     * @param address user contract address
     * @param poolConfig pool config
     */
    static createFromAddress(address: Address, poolConfig: PoolConfig = MAINNET_POOL_CONFIG) {
        return new EvaaUser(address, poolConfig);
    }

    private constructor(address: Address, poolConfig: PoolConfig = MAINNET_POOL_CONFIG) {
        this.address = address;
        this.poolConfig = poolConfig;
    }

    async getSyncLite(
        provider: ContractProvider,
        assetsData: ExtendedAssetsData,
        assetsConfig: ExtendedAssetsConfig,
        applyDust: boolean = false,
    ) {
        const state = (await provider.getState()).state;
        if (state.type === 'active') {
            this._liteData = parseUserLiteData(
                state.data!.toString('base64'),
                assetsData,
                assetsConfig,
                this.poolConfig,
                applyDust,
            );
            this.lastSync = Math.floor(Date.now() / 1000);
        } else {
            this._liteData = undefined;
            this._data = { type: 'inactive' };
        }
    }

    /**
     * Calculate full user data from lite data and prices
     * @param assetsData assets data
     * @param assetsConfig assets config
     * @param prices prices
     * @returns true if user data was calculated
     */
    calculateUserData(
        assetsData: ExtendedAssetsData,
        assetsConfig: ExtendedAssetsConfig,
        prices: Dictionary<bigint, bigint>,
    ): boolean {
        if (this._liteData) {
            this._data = parseUserData(this._liteData, assetsData, assetsConfig, prices, this.poolConfig);
            return true;
        }
        return false;
    }

    /**
     * Open user contract wrapper
     * @param forwardPayload - payload that will be forwarded to the address which requested the data
     */
    async sendOnchainGetter(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
        forwardPayload: Cell,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            body: beginCell()
                .storeCoins(BigInt(OPCODES.ONCHAIN_GETTER))
                .storeUint(queryID, 64)
                .storeRef(forwardPayload)
                .endCell(),
        });
    }

    async getSync(
        provider: ContractProvider,
        assetsData: ExtendedAssetsData,
        assetsConfig: ExtendedAssetsConfig,
        prices: Dictionary<bigint, bigint>,
        applyDust: boolean = false,
    ) {
        const state = (await provider.getState()).state;
        if (state.type === 'active') {
            this._liteData = parseUserLiteData(
                state.data!.toString('base64'),
                assetsData,
                assetsConfig,
                this.poolConfig,
                applyDust,
            );
            this._data = parseUserData(this._liteData, assetsData, assetsConfig, prices, this.poolConfig, applyDust);
            this.lastSync = Math.floor(Date.now() / 1000);
        } else {
            this._data = { type: 'inactive' };
        }
    }

    /**
     * Get user contract lite data
     * @returns user lite data if available, otherwise undefined
     */
    get liteData(): UserLiteData | undefined {
        return this._liteData;
    }

    /**
     * Get user contract full data
     * @returns user data if available  , otherwise undefined
     */
    get data(): UserData | undefined {
        return this._data;
    }

    /**
     * Get if user is liquidable
     * @returns true if user is liquidable
     */
    get isLiquidable(): boolean {
        if (!this._data || this._data.type === 'inactive') {
            return false;
        }

        return this._data.liquidationData.liquidable;
    }
}
