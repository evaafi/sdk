import { Address, Contract, ContractProvider, Dictionary } from '@ton/core';
import { UserData } from '../types/User';
import { parseUserData } from '../api/parser';
import { AssetConfig, ExtendedAssetData } from '../types/Master';
import { LiquidationBaseData } from './MasterContract';
import { ASSET_ID } from '../constants';

export class EvaaUser implements Contract {
    readonly address: Address;
    private lastSync = 0;
    private _data?: UserData;

    static createFromAddress(address: Address) {
        return new EvaaUser(address);
    }

    private constructor(address: Address) {
        this.address = address;
    }

    async getSync(
        provider: ContractProvider,
        assetsData: Dictionary<bigint, ExtendedAssetData>,
        assetsConfig: Dictionary<bigint, AssetConfig>,
        prices: Dictionary<bigint, bigint>,
    ) {
        const state = (await provider.getState()).state;
        if (state.type === 'active') {
            this._data = parseUserData(state.data!.toString('base64url'), assetsData, assetsConfig, prices);
            this.lastSync = Math.floor(Date.now() / 1000);
        } else {
            this._data = { type: 'inactive' };
        }
    }

    get data(): UserData | undefined {
        return this._data;
    }

    get isLiquidable(): boolean {
        if (!this._data || this._data.type === 'inactive') {
            return false;
        }

        return this._data.liquidationData.liquidable;
    }

    get liquidationParameters(): LiquidationBaseData | undefined {
        if (!this._data || this._data.type === 'inactive' || !this._data.liquidationData.liquidable) {
            return undefined;
        }

        return {
            borrowerAddress: this._data.ownerAddress,
            loanAsset: this._data.liquidationData.greatestLoanAsset,
            collateralAsset: this._data.liquidationData.greatestCollateralAsset,
            minCollateralAmount: this._data.liquidationData.minCollateralAmount,
            liquidationAmount: this._data.liquidationData.liquidationAmount,
            tonLiquidation: this._data.liquidationData.greatestLoanAsset === ASSET_ID.TON,
        };
    }
}
