import { CATI_MAINNET, DOGS_MAINNET, getUserJettonWallet, JUSDC_MAINNET, JUSDT_MAINNET, NOT_MAINNET, STTON_MAINNET, TON_STORM_MAINNET, TONUSDT_DEDUST_MAINNET, TSTON_MAINNET, USDT_MAINNET, USDT_STORM_MAINNET, UTON_MAINNET } from "../../src";
import { Address } from "@ton/core";
describe('Address calculation tests', () => {
    test('test dogs address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQAzGe080FVBQDMhh-YvGqV1M2Q0wZuCE3ugArRzS2BmpyPp').address, DOGS_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQDli8YqXU5oXAUiiPjpq_2_bOfKnGBBcYYc5fnOhe4E4B_L');
    });

    test('test cati address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('EQCWfRCrZNpLhjGwl5xhX6-TbUrPYDEIlMd-Iob94YRddbp4').address, CATI_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQBiTjZl2NHc3ua85JDw8Rve_gpR0P3JKfZurXTVp-RE73Jz');
    });

    test('test not address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQBzuspXXr9HylmNl8wP1lIHEysMBiUckha5D0Qsh6nhyUDo').address, NOT_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQBxJam6UYfv-NRmOWeWHfUieftRC4GyEB1_p8M3zVApvJph');
    });

    test('test uton address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQBzuspXXr9HylmNl8wP1lIHEysMBiUckha5D0Qsh6nhyUDo').address, UTON_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQCuxwHIo617WeYx-9kQEeWzAVd-iTz9quzIxNBE1F68QB56');
    });

    test('test usdt address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address, USDT_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQCUBNu-5XO-O-bbeFbTYLHWjFBBjwcGo9O3a7zNYv-nfVMy');
    });

    test('test jusdt address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address, JUSDT_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQCRelFNpDehR3Z3YHF47zvKN3HcZUmTW-yzsxPrFKcAcvTs');
    });

    test('test jusdc address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address, JUSDC_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQAAwGbiUHftAcgdoPgcPgIxPLMEuOujglNHnOy9UEVvlpTJ');
    });

    test('test jusdc address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address, JUSDC_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQAAwGbiUHftAcgdoPgcPgIxPLMEuOujglNHnOy9UEVvlpTJ');
    });

    test('test stton address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address, STTON_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQA-LXnO983HeNgZA0owrLImGWb0Bme_VwyxDb8jnoxmFz45');
    });

    test('test tston address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQA7Im6ZElCE8EJSwzBfExGts2gsT7IpPW-hM7V1sxL7Y-B7').address, TSTON_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQAxoKC0wkCud7RKZIGiYqfAB7VU6tzIex09FPJxgBWzzihP');
    });

    test('test tonusdtdedust address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address, TONUSDT_DEDUST_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQCVoBaGdR1Lm6DTVYt1lcuEK6m3Jpm_Hxccg-rJ9ihtEWCf');
    });

    test('test tonusdtdedust address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address, TONUSDT_DEDUST_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQCVoBaGdR1Lm6DTVYt1lcuEK6m3Jpm_Hxccg-rJ9ihtEWCf');
    });

    test('test usdtstorm address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address, USDT_STORM_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQBFUoJlvVp9HGyMS5mxQKKRpoi0DcyJhwepqdoT2s_pavl9');
    });

    test('test tonstorm address', () => {
        const walletAddr = getUserJettonWallet(Address.parseFriendly('UQDN5CpSs8HT2GO4IymOXPS5zTDzHtY-s8VTuUVAsCTwWJzM').address, TON_STORM_MAINNET);
        expect(walletAddr.toString({urlSafe: true, bounceable: true})).toEqual('EQD-kqf7eTWfcEWI3lqm8V8ww_6Vop5DFFyuEU4hH7yazsXS');
    });
});