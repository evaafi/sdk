import { sha256Hash } from '../../utils/sha256BigInt';

export const ASSET_ID = {
    EVAA: sha256Hash('EVAA'),

    // Main
    // GRAM (formerly TON). The token id is sha256('TON') for historical reasons:
    // the native asset was registered on-chain as 'TON' before the GRAM rebrand,
    // so the id must stay sha256('TON') to keep matching existing on-chain state.
    GRAM: sha256Hash('TON'),
    /** @deprecated renamed to GRAM; kept for backward compatibility. Same id (sha256('TON')). */
    TON: sha256Hash('TON'),
    USDT: sha256Hash('USDT'),
    jUSDT: sha256Hash('jUSDT'),
    jUSDC: sha256Hash('jUSDC'),
    stTON: sha256Hash('stTON'),
    tsTON: sha256Hash('tsTON'),
    tgBTC: sha256Hash('tgBTC'),
    USDe: sha256Hash('USDe'),
    tsUSDe: sha256Hash('tsUSDe'),

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

    // STABLE
    PT_tsUSDe_01Sep2025: sha256Hash('PT_tsUSDe_01Sep2025'),
    PT_tsUSDe_18Dec2025: sha256Hash('PT_tsUSDe_18Dec2025'),

    // Mainnet test assets
    TUSDT: sha256Hash('TUSDT'),
    TUSDe: sha256Hash('TUSDe'),

    // Testnet assets, faucet t.me/evaabuidl
    EUSDT: sha256Hash('EUSDT'),
    EUSDC: sha256Hash('EUSDC'),
};
