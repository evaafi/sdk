import { sha256Hash } from '../../utils/sha256BigInt';

export const ASSET_ID = {
    EVAA: sha256Hash('EVAA'),

    // Main
    TON: sha256Hash('TON'),
    USDT: sha256Hash('USDT'),
    jUSDT: sha256Hash('jUSDT'),
    jUSDC: sha256Hash('jUSDC'),
    stTON: sha256Hash('stTON'),
    tsTON: sha256Hash('tsTON'),
    tgBTC: sha256Hash('tgBTC'),
    USDe: sha256Hash('USDe'),
    tsUSDe: sha256Hash('tsUSDe'),
    PT_tsUSDe_01Sep2025: sha256Hash('PT_tsUSDe_01Sep2025'),

    // LP
    TONUSDT_DEDUST: sha256Hash('TONUSDT_DEDUST'),
    TONUSDT_STONFI: sha256Hash('TONUSDT_STONFI'),
    TON_STORM: sha256Hash('TON_STORM'),
    USDT_STORM: sha256Hash('USDT_STORM'),

    // ALTS
    NOT: sha256Hash('NOT'),
    DOGS: sha256Hash('DOGS'),
    CATI: sha256Hash('CATI'),
    STON: sha256Hash('STON'),

    // Testnet assets, faucet t.me/evaabuidl
    EUSDT: sha256Hash('EUSDT'),
    EUSDC: sha256Hash('EUSDC'),
};
