import { Address, beginCell, storeStateInit } from '@ton/core';
import { Evaa, MAINNET_POOL_CONFIG, TESTNET_PYTH_POOL_CONFIG_TOB_AUDITED, isValidSubaccountId } from '../../src';

// These tests validate that subaccount IDs produce deterministic and distinct user contract addresses
// and that helper methods return consistent results.
describe('Subaccount calculation tests', () => {
    const userAddr = Address.parseFriendly('EQBOq441r0EiLi1VXlH_-ez9piPIe_4Kyzk5zNk04jTgfiIH').address;
    const evaa = new Evaa({ poolConfig: MAINNET_POOL_CONFIG });

    test('default subaccount (0) equals openUserContract() without subaccountId', () => {
        const calc0 = evaa.calculateUserSCAddr(userAddr, MAINNET_POOL_CONFIG.lendingCode, 0);
        const opened0 = evaa.openUserContract(userAddr).address;

        expect(calc0.toString({ urlSafe: true, bounceable: true })).toEqual(
            opened0.toString({ urlSafe: true, bounceable: true }),
        );
    });

    test('subaccountId=1 yields different address than subaccountId=0 and matches manual state init computation', () => {
        const addr0 = evaa.calculateUserSCAddr(userAddr, MAINNET_POOL_CONFIG.lendingCode, 0);
        const addr1 = evaa.calculateUserSCAddr(userAddr, MAINNET_POOL_CONFIG.lendingCode, 1);
        const opened1 = evaa.openUserContract(userAddr, 1).address;

        // Different from base
        expect(addr1.toString({ urlSafe: true, bounceable: true })).not.toEqual(
            addr0.toString({ urlSafe: true, bounceable: true }),
        );

        // Consistency with openUserContract
        expect(addr1.toString({ urlSafe: true, bounceable: true })).toEqual(
            opened1.toString({ urlSafe: true, bounceable: true }),
        );

        // Manual computation using the same state init layout with subaccount builder storing 1 as 16 bits
        const lendingDataSub1 = beginCell()
            .storeAddress(evaa.address)
            .storeAddress(userAddr)
            .storeUint(0, 8)
            .storeBit(0)
            .storeBuilder(beginCell().storeInt(1, 16))
            .endCell();
        const stateInitSub1 = beginCell()
            .store(
                storeStateInit({
                    code: MAINNET_POOL_CONFIG.lendingCode,
                    data: lendingDataSub1,
                }),
            )
            .endCell();
        const manualAddr1 = new Address(0, stateInitSub1.hash());

        expect(manualAddr1.toString({ urlSafe: true, bounceable: true })).toEqual(
            addr1.toString({ urlSafe: true, bounceable: true }),
        );

        // For subaccountId=0, calculateUserSCAddr uses an empty builder, which must differ from a builder with explicit 0
        const lendingDataExplicit0 = beginCell()
            .storeAddress(evaa.address)
            .storeAddress(userAddr)
            .storeUint(0, 8)
            .storeBit(0)
            .storeBuilder(beginCell().storeInt(0, 16))
            .endCell();
        const stateInitExplicit0 = beginCell()
            .store(
                storeStateInit({
                    code: MAINNET_POOL_CONFIG.lendingCode,
                    data: lendingDataExplicit0,
                }),
            )
            .endCell();
        const manualAddrExplicit0 = new Address(0, stateInitExplicit0.hash());

        expect(manualAddrExplicit0.toString({ urlSafe: true, bounceable: true })).not.toEqual(
            addr0.toString({ urlSafe: true, bounceable: true }),
        );
    });

    test('addresses are unique and deterministic across valid subaccount IDs (incl. boundaries)', () => {
        const ids = [0, 1, 2, 42, 32766, 32767, -1, -32767]; // include boundary-valid values
        const results = ids.map((id) =>
            evaa.calculateUserSCAddr(userAddr, MAINNET_POOL_CONFIG.lendingCode, id).toString({
                urlSafe: true,
                bounceable: true,
            }),
        );

        // all unique
        const unique = new Set(results);
        expect(unique.size).toBe(results.length);

        // deterministic: recompute and compare
        const results2 = ids.map((id) =>
            evaa.calculateUserSCAddr(userAddr, MAINNET_POOL_CONFIG.lendingCode, id).toString({
                urlSafe: true,
                bounceable: true,
            }),
        );
        expect(results2).toEqual(results);

        // invalid boundaries should throw
        expect(() => evaa.calculateUserSCAddr(userAddr, MAINNET_POOL_CONFIG.lendingCode, 32768)).toThrow();
        expect(() => evaa.calculateUserSCAddr(userAddr, MAINNET_POOL_CONFIG.lendingCode, -32768)).toThrow();
    });

    test('should verify hardcoded user smart contract address matches calculated address', () => {
        const walletAddr = Address.parse('EQBOq441r0EiLi1VXlH_-ez9piPIe_4Kyzk5zNk04jTgfiIH');
        // calculated by master method: get_user_subaccount_address(slice owner_address, int subaccount_id)
        const userscAddr = Address.parse('EQBy7kwQlwo-coBBC7UZmhjzdCq0caa5UIOMc39CEje_WDWi'); // subaccount == 0
        const evaa = new Evaa({ poolConfig: TESTNET_PYTH_POOL_CONFIG_TOB_AUDITED });
        const addr = evaa.calculateUserSCAddr(walletAddr, TESTNET_PYTH_POOL_CONFIG_TOB_AUDITED.lendingCode, 0);
        expect(addr.toString({ urlSafe: true, bounceable: true })).toEqual(
            userscAddr.toString({ urlSafe: true, bounceable: true }),
        );
    });

    test('isValidSubaccountId boundary cases', () => {
        // 0x7FFF (32767) is the maximum allowed 16-bit signed value
        expect(isValidSubaccountId(0x7fff)).toBe(true);
        // 0x7FFF + 1 (32768) exceeds the range and should be invalid
        expect(isValidSubaccountId(0x7fff + 1)).toBe(false);
        // -0x8000 (-32768) is explicitly excluded by implementation
        expect(isValidSubaccountId(-0x8000)).toBe(false);
        // -0x8000 - 1 (-32769) is out of 16-bit signed range and should be invalid
        expect(isValidSubaccountId(-0x8000 - 1)).toBe(false);
    });
});
